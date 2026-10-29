import {
  commandSchema,
  decodeJson,
  parseInput,
  productSchema,
  resultSchema,
  StockroomFault,
  type CountCommand,
  type CountEvent,
  type CountRecord,
  type CountRepository,
  type CountState,
  type Product,
  type Snapshot,
  type SqlDriver,
  type SubmitResult,
} from '../../../../shared/contracts';
import { retryDelay, reviewNote } from '../../../../shared/counts';

function record(row: Record<string, unknown>): CountRecord {
  const states: CountState[] = [
    'queued',
    'synced',
    'conflict',
    'superseded',
    'cancelled',
    'failed',
  ];
  if (
    !states.includes(row.state as CountState) ||
    typeof row.attempts !== 'number' ||
    typeof row.next_attempt !== 'number'
  )
    throw new StockroomFault('STORAGE', 'Stored queue state is invalid.');
  return {
    command: parseInput(commandSchema, decodeJson(row.payload)),
    state: row.state as CountState,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt,
    error: typeof row.error === 'string' ? row.error : null,
    remote: row.remote === null ? null : parseInput(productSchema, decodeJson(row.remote)),
  };
}
export class ClientRepository implements CountRepository {
  constructor(
    private readonly database: SqlDriver,
    private readonly clock: () => string,
  ) {}
  async initialize(products: readonly Product[]): Promise<void> {
    await this.database.transaction(async (sql) => {
      await sql.run(
        'CREATE TABLE IF NOT EXISTS local_products (id TEXT PRIMARY KEY,value TEXT NOT NULL)',
      );
      await sql.run(
        "CREATE TABLE IF NOT EXISTS counts (id TEXT PRIMARY KEY,product_id TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('queued','synced','conflict','superseded','cancelled','failed')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,error TEXT,remote TEXT)",
      );
      await sql.run(
        "CREATE UNIQUE INDEX IF NOT EXISTS one_active_count ON counts(product_id) WHERE state IN ('queued','conflict','failed')",
      );
      await sql.run(
        'CREATE TABLE IF NOT EXISTS count_events (id INTEGER PRIMARY KEY AUTOINCREMENT,command_id TEXT NOT NULL REFERENCES counts(id),kind TEXT NOT NULL,note TEXT NOT NULL,at TEXT NOT NULL)',
      );
      for (const verb of ['UPDATE', 'DELETE'])
        await sql.run(
          `CREATE TRIGGER IF NOT EXISTS events_no_${verb.toLowerCase()} BEFORE ${verb} ON count_events BEGIN SELECT RAISE(ABORT,'Count history is append-only'); END`,
        );
      for (const product of products) {
        const valid = parseInput(productSchema, product);
        await sql.run('INSERT OR IGNORE INTO local_products (id,value) VALUES (?,?)', [
          valid.id,
          JSON.stringify(valid),
        ]);
      }
    });
  }
  async snapshot(): Promise<Snapshot> {
    return this.database.transaction(async (sql) => ({
      products: (await sql.all('SELECT value FROM local_products ORDER BY id')).map((row) =>
        parseInput(productSchema, decodeJson(row.value)),
      ),
      counts: (await sql.all('SELECT * FROM counts ORDER BY rowid DESC')).map(record),
      events: (await sql.all('SELECT * FROM count_events ORDER BY id DESC')).map(
        (row) =>
          ({
            id: Number(row.id),
            commandId: String(row.command_id),
            kind: String(row.kind),
            note: String(row.note),
            at: String(row.at),
          }) satisfies CountEvent,
      ),
    }));
  }
  private async add(sql: SqlDriver, input: CountCommand): Promise<void> {
    const command = parseInput(commandSchema, input);
    const product = (
      await sql.all('SELECT value FROM local_products WHERE id=?', [command.productId])
    )[0];
    if (!product)
      throw new StockroomFault('NOT_FOUND', 'This product is not in the local catalog.');
    if (parseInput(productSchema, decodeJson(product.value)).version !== command.baseVersion)
      throw new StockroomFault('BLOCKED', 'The catalog changed. Review this count again.');
    if (
      (
        await sql.all(
          "SELECT id FROM counts WHERE product_id=? AND state IN ('queued','conflict','failed')",
          [command.productId],
        )
      ).length
    )
      throw new StockroomFault('BLOCKED', 'Finish the existing count for this product first.');
    await sql.run("INSERT INTO counts (id,product_id,payload,state) VALUES (?,?,?,'queued')", [
      command.id,
      command.productId,
      JSON.stringify(command),
    ]);
    await this.event(sql, command.id, 'queued', command.note, command.createdAt);
  }
  private async event(
    sql: SqlDriver,
    id: string,
    kind: string,
    note: string,
    at: string,
  ): Promise<void> {
    await sql.run('INSERT INTO count_events (command_id,kind,note,at) VALUES (?,?,?,?)', [
      id,
      kind,
      note,
      at,
    ]);
  }
  async enqueue(command: CountCommand): Promise<void> {
    await this.database.transaction((sql) => this.add(sql, command));
  }
  async due(at: number): Promise<CountRecord[]> {
    return (
      await this.database.all(
        "SELECT * FROM counts WHERE state='queued' AND next_attempt<=? ORDER BY rowid",
        [at],
      )
    ).map(record);
  }
  private async get(sql: SqlDriver, id: string): Promise<CountRecord> {
    const row = (await sql.all('SELECT * FROM counts WHERE id=?', [id]))[0];
    if (!row) throw new StockroomFault('NOT_FOUND', 'This count is no longer in the queue.');
    return record(row);
  }
  private async merge(sql: SqlDriver, product: Product): Promise<void> {
    const valid = parseInput(productSchema, product);
    const current = (await sql.all('SELECT value FROM local_products WHERE id=?', [valid.id]))[0];
    if (current && parseInput(productSchema, decodeJson(current.value)).version > valid.version)
      return;
    await sql.run(
      'INSERT INTO local_products (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
      [valid.id, JSON.stringify(valid)],
    );
  }
  async acknowledge(input: SubmitResult): Promise<void> {
    const result = parseInput(resultSchema, input);
    await this.database.transaction(async (sql) => {
      const count = await this.get(sql, result.commandId);
      if (count.state !== 'queued') return;
      if (
        result.product.id !== count.command.productId ||
        (result.kind === 'applied' &&
          (result.product.version !== count.command.baseVersion + 1 ||
            result.product.onHand !== count.command.quantity)) ||
        (result.kind === 'conflict' && result.product.version <= count.command.baseVersion)
      )
        throw new StockroomFault(
          'INVALID_INPUT',
          'The server receipt does not match the queued count.',
        );
      await this.merge(sql, result.product);
      await sql.run('UPDATE counts SET state=?,remote=?,error=NULL WHERE id=?', [
        result.kind === 'applied' ? 'synced' : 'conflict',
        JSON.stringify(result.product),
        result.commandId,
      ]);
      await this.event(
        sql,
        result.commandId,
        result.kind,
        result.kind === 'applied' ? 'Server receipt saved.' : 'A newer server count needs review.',
        result.recordedAt,
      );
    });
  }
  async defer(id: string, at: number, message: string): Promise<void> {
    await this.database.transaction(async (sql) => {
      const count = await this.get(sql, id);
      if (count.state !== 'queued') return;
      const attempts = count.attempts + 1;
      await sql.run('UPDATE counts SET attempts=?,next_attempt=?,state=?,error=? WHERE id=?', [
        attempts,
        at + retryDelay(attempts, id),
        attempts >= 5 ? 'failed' : 'queued',
        message.slice(0, 200),
        id,
      ]);
      await this.event(
        sql,
        id,
        attempts >= 5 ? 'paused' : 'retry',
        'Delivery could not be confirmed.',
        this.clock(),
      );
    });
  }
  async mergeCatalog(products: Product[]): Promise<void> {
    await this.database.transaction(async (sql) => {
      for (const product of products) await this.merge(sql, product);
    });
  }
  async resolve(
    id: string,
    decision: 'recount' | 'keep-server',
    replacement: CountCommand | null,
    note: string,
    at: string,
  ): Promise<void> {
    const reviewedNote = reviewNote(note);
    await this.database.transaction(async (sql) => {
      const count = await this.get(sql, id);
      if (count.state !== 'conflict' || !count.remote)
        throw new StockroomFault('BLOCKED', 'Only conflicted counts can be resolved.');
      if (
        decision === 'recount' &&
        (!replacement ||
          replacement.supersedesId !== id ||
          replacement.productId !== count.command.productId ||
          replacement.baseVersion < count.remote.version)
      )
        throw new StockroomFault('INVALID_INPUT', 'Recount against the displayed server revision.');
      if (decision === 'keep-server' && replacement)
        throw new StockroomFault(
          'INVALID_INPUT',
          'Keeping the server count cannot queue a replacement.',
        );
      await sql.run('UPDATE counts SET state=? WHERE id=?', [
        decision === 'recount' ? 'superseded' : 'cancelled',
        id,
      ]);
      if (replacement) await this.add(sql, replacement);
      await this.event(sql, id, decision, reviewedNote, at);
    });
  }
  async retry(id: string): Promise<void> {
    await this.database.transaction(async (sql) => {
      const count = await this.get(sql, id);
      if (count.state !== 'failed')
        throw new StockroomFault('BLOCKED', 'Only paused counts can be retried.');
      await sql.run(
        "UPDATE counts SET state='queued',attempts=0,next_attempt=0,error=NULL WHERE id=?",
        [id],
      );
      await this.event(
        sql,
        id,
        'retry-resumed',
        'Delivery resumed with the same command ID.',
        this.clock(),
      );
    });
  }
}
