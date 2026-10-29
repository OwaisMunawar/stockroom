import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver } from '../shared/contracts';
import { SerialQueue } from '../shared/serial';

export class NodeSqlite implements SqlDriver {
  private readonly database: DatabaseSync;
  private readonly queue = new SerialQueue();
  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec(
      'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
    );
  }
  async run(sql: string, params: readonly (string | number | null)[] = []): Promise<number> {
    return Number(this.database.prepare(sql).run(...params).changes);
  }
  async all(
    sql: string,
    params: readonly (string | number | null)[] = [],
  ): Promise<Record<string, unknown>[]> {
    return this.database.prepare(sql).all(...params);
  }
  transaction<T>(work: (sql: SqlDriver) => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      this.database.exec('BEGIN IMMEDIATE');
      try {
        const value = await work(this);
        this.database.exec('COMMIT');
        return value;
      } catch (error) {
        this.database.exec('ROLLBACK');
        throw error;
      }
    });
  }
  close(): void {
    this.database.close();
  }
}
