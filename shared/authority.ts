import { applyCount, commandFingerprint } from './counts';
import {
  commandSchema,
  decodeJson,
  parseInput,
  productSchema,
  resultSchema,
  StockroomFault,
  type CountCommand,
  type CountTransport,
  type Product,
  type SqlDriver,
  type SubmitResult,
} from './contracts';

export class WarehouseAuthority implements CountTransport {
  private readonly products: string;
  private readonly receipts: string;
  constructor(
    private readonly database: SqlDriver,
    namespace: 'server' | 'demo',
    private readonly clock: () => string,
  ) {
    this.products = `${namespace}_products`;
    this.receipts = `${namespace}_receipts`;
  }
  async initialize(products: readonly Product[]): Promise<void> {
    await this.database.transaction(async (sql) => {
      await sql.run(
        `CREATE TABLE IF NOT EXISTS ${this.products} (id TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      );
      await sql.run(
        `CREATE TABLE IF NOT EXISTS ${this.receipts} (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, response TEXT NOT NULL)`,
      );
      for (const product of products) {
        const valid = parseInput(productSchema, product);
        await sql.run(`INSERT OR IGNORE INTO ${this.products} (id,value) VALUES (?,?)`, [
          valid.id,
          JSON.stringify(valid),
        ]);
      }
    });
  }
  async catalog(): Promise<Product[]> {
    return this.database.transaction(async (sql) =>
      (await sql.all(`SELECT value FROM ${this.products} ORDER BY id`)).map((row) =>
        parseInput(productSchema, decodeJson(row.value)),
      ),
    );
  }
  async submit(input: CountCommand): Promise<SubmitResult> {
    const command = parseInput(commandSchema, input);
    const fingerprint = commandFingerprint(command);
    return this.database.transaction(async (sql) => {
      const receipt = (
        await sql.all(`SELECT fingerprint,response FROM ${this.receipts} WHERE id=?`, [command.id])
      )[0];
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new StockroomFault(
            'IDEMPOTENCY_MISMATCH',
            'This command ID was already used for different count data.',
          );
        return parseInput(resultSchema, decodeJson(receipt.response));
      }
      const row = (
        await sql.all(`SELECT value FROM ${this.products} WHERE id=?`, [command.productId])
      )[0];
      if (!row) throw new StockroomFault('NOT_FOUND', 'This product does not exist.');
      const result = applyCount(
        parseInput(productSchema, decodeJson(row.value)),
        command,
        this.clock(),
      );
      if (result.kind === 'applied')
        await sql.run(`UPDATE ${this.products} SET value=? WHERE id=?`, [
          JSON.stringify(result.product),
          result.product.id,
        ]);
      await sql.run(`INSERT INTO ${this.receipts} (id,fingerprint,response) VALUES (?,?,?)`, [
        command.id,
        fingerprint,
        JSON.stringify(result),
      ]);
      return result;
    });
  }
}
