import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { WarehouseAuthority } from '../shared/authority';
import { sampleCatalog } from '../shared/catalog';
import { createCountServer } from './http';
import { NodeSqlite } from './sqlite';

async function main(): Promise<void> {
  const directory = resolve(process.env.STOCKROOM_DATA_DIR ?? 'server/data');
  mkdirSync(directory, { recursive: true });
  const database = new NodeSqlite(resolve(directory, 'warehouse.db'));
  const authority = new WarehouseAuthority(database, 'server', () => new Date().toISOString());
  await authority.initialize(sampleCatalog);
  const port = Number(process.env.PORT ?? 8057);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const server = createCountServer(authority);
  server.listen(port, '127.0.0.1', () =>
    process.stdout.write(`Stockroom reference server listening on 127.0.0.1:${port}\n`),
  );
  const shutdown = (): void => {
    server.close(() => {
      database.close();
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
void main().catch(() => {
  process.stderr.write('Stockroom server failed to start.\n');
  process.exitCode = 1;
});
