import type { SQLiteDatabase } from 'expo-sqlite';
import { SerialQueue } from '../../../../shared/serial';
import type { SqlDriver } from '../../../../shared/contracts';

export class ExpoDatabase implements SqlDriver {
  private readonly queue = new SerialQueue();
  constructor(private readonly database: SQLiteDatabase) {}
  async run(sql: string, params: readonly (string | number | null)[] = []): Promise<number> {
    return (await this.database.runAsync(sql, [...params])).changes;
  }
  async all(
    sql: string,
    params: readonly (string | number | null)[] = [],
  ): Promise<Record<string, unknown>[]> {
    return this.database.getAllAsync(sql, [...params]);
  }
  transaction<T>(work: (sql: SqlDriver) => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      await this.database.execAsync('BEGIN IMMEDIATE');
      try {
        const value = await work(this);
        await this.database.execAsync('COMMIT');
        return value;
      } catch (error) {
        await this.database.execAsync('ROLLBACK');
        throw error;
      }
    });
  }
}
