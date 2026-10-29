import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sampleCatalog } from '../../shared/catalog';
import { WarehouseAuthority } from '../../shared/authority';
import { ClientRepository } from '../../src/features/counts/data/clientRepository';
import { NodeSqlite } from '../../server/sqlite';
import { command, fixture, product, time } from '../support';

let context: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  context = await fixture();
});
afterEach(() => context.close());
test('a queued count does not change stock until an authoritative receipt arrives', async () => {
  await context.repository.enqueue(command());
  await context.repository.initialize(sampleCatalog);
  expect(
    (await context.repository.snapshot()).products.find((p) => p.id === product.id)?.onHand,
  ).toBe(18);
  await expect(context.repository.enqueue(command('count-two'))).rejects.toThrow('existing count');
  const receipt = await context.authority.submit(command());
  await context.repository.acknowledge(receipt);
  await context.repository.acknowledge(receipt);
  const snapshot = await context.repository.snapshot();
  expect(snapshot.counts[0]?.state).toBe('synced');
  expect(snapshot.events).toHaveLength(2);
  expect(snapshot.products.find((p) => p.id === product.id)?.onHand).toBe(14);
});
test('duplicate delivery is replayed durably and changed payload IDs are rejected', async () => {
  const first = await context.authority.submit(command());
  const replay = await context.authority.submit(command());
  expect(replay).toEqual(first);
  await expect(context.authority.submit(command('count-one', 15))).rejects.toThrow(
    'different count data',
  );
  expect((await context.authority.catalog()).find((p) => p.id === product.id)?.version).toBe(2);
});
test('competing devices produce one update and one explicit conflict', async () => {
  const results = await Promise.all([
    context.authority.submit(command('device-one', 14)),
    context.authority.submit(command('device-two', 12)),
  ]);
  expect(results.map((r) => r.kind).sort()).toEqual(['applied', 'conflict']);
  expect((await context.authority.catalog()).find((p) => p.id === product.id)?.version).toBe(2);
});
test('conflict replacement preserves history and binds the displayed server version', async () => {
  await context.repository.enqueue(command());
  await context.authority.submit(command('remote-count', 12));
  const conflict = await context.authority.submit(command());
  await context.repository.acknowledge(conflict);
  await expect(
    context.repository.resolve(
      'count-one',
      'recount',
      command('bad-recount', 14, 1),
      'Recounted',
      time,
    ),
  ).rejects.toThrow();
  expect((await context.repository.snapshot()).counts[0]?.state).toBe('conflict');
  const replacement = { ...command('recount-one', 14, 2), supersedesId: 'count-one' };
  await context.repository.resolve(
    'count-one',
    'recount',
    replacement,
    'Counted again against server revision 2',
    time,
  );
  expect((await context.repository.snapshot()).counts.map((c) => c.state)).toEqual([
    'queued',
    'superseded',
  ]);
  await context.repository.acknowledge(await context.authority.submit(replacement));
  expect(
    (await context.repository.snapshot()).products.find((p) => p.id === product.id)?.onHand,
  ).toBe(14);
  await expect(
    context.repository.resolve('count-one', 'keep-server', null, 'Already resolved', time),
  ).rejects.toThrow();
});
test('keeping the server count records the human decision without another mutation', async () => {
  await context.repository.enqueue(command());
  await context.authority.submit(command('remote-count', 12));
  await context.repository.acknowledge(await context.authority.submit(command()));
  await expect(
    context.repository.resolve('count-one', 'keep-server', command('invalid'), 'Reviewed', time),
  ).rejects.toThrow();
  await expect(
    context.repository.resolve('count-one', 'keep-server', null, '', time),
  ).rejects.toThrow();
  await context.repository.resolve(
    'count-one',
    'keep-server',
    null,
    'Accepted the newer verified count',
    time,
  );
  expect((await context.repository.snapshot()).counts[0]?.state).toBe('cancelled');
});
test('malformed receipts cannot acknowledge a queued command', async () => {
  await context.repository.enqueue(command());
  const receipt = await context.authority.submit(command());
  await expect(
    context.repository.acknowledge({ ...receipt, product: { ...receipt.product, onHand: 999 } }),
  ).rejects.toThrow();
  await expect(
    context.repository.acknowledge({
      ...receipt,
      product: { ...receipt.product, id: 'wrong-product' },
    }),
  ).rejects.toThrow();
  await expect(
    context.repository.acknowledge({ ...receipt, kind: 'conflict', product }),
  ).rejects.toThrow();
  expect((await context.repository.snapshot()).counts[0]?.state).toBe('queued');
});
test('transient failures back off, pause after five and resume with the same id', async () => {
  await context.repository.enqueue(command());
  for (let attempt = 0; attempt < 5; attempt++)
    await context.repository.defer('count-one', 1000, 'network');
  expect((await context.repository.snapshot()).counts[0]?.state).toBe('failed');
  expect(await context.repository.due(1e9)).toHaveLength(0);
  await context.repository.retry('count-one');
  expect(await context.repository.due(1e9)).toHaveLength(1);
  await expect(context.repository.retry('count-one')).rejects.toThrow();
  await context.repository.acknowledge(await context.authority.submit(command()));
  await context.repository.defer('count-one', 1000, 'ignored');
  expect((await context.repository.snapshot()).counts[0]?.state).toBe('synced');
});
test('catalog versions never move backwards and invalid queue operations roll back', async () => {
  await context.repository.mergeCatalog([{ ...product, onHand: 10, version: 3 }]);
  await context.repository.mergeCatalog([product]);
  expect(
    (await context.repository.snapshot()).products.find((p) => p.id === product.id)?.version,
  ).toBe(3);
  await expect(context.repository.enqueue(command())).rejects.toThrow('changed');
  await expect(
    context.repository.enqueue({ ...command(), productId: 'missing-product' }),
  ).rejects.toThrow();
  await expect(
    context.authority.submit({ ...command(), productId: 'missing-product' }),
  ).rejects.toThrow();
  await expect(context.repository.retry('missing-count')).rejects.toThrow();
});
test('history cannot be modified through SQL and corrupt rows fail closed', async () => {
  await context.repository.enqueue({
    ...command(),
    note: "Counted 14 brass adapters; note ' is preserved",
  });
  await expect(context.local.run("UPDATE count_events SET note='changed'")).rejects.toThrow();
  await expect(context.local.run('DELETE FROM count_events')).rejects.toThrow();
  await context.local.run('UPDATE counts SET payload=?', ['{}']);
  await expect(context.repository.snapshot()).rejects.toThrow();
});
test('outbox and receipts survive closing and reopening a real disk database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stockroom-test-'));
  const path = join(directory, 'test.db');
  let database = new NodeSqlite(path);
  let repo = new ClientRepository(database, () => time);
  let authority = new WarehouseAuthority(database, 'server', () => time);
  await repo.initialize(sampleCatalog);
  await authority.initialize(sampleCatalog);
  await repo.enqueue(command());
  const receipt = await authority.submit(command());
  database.close();
  database = new NodeSqlite(path);
  repo = new ClientRepository(database, () => time);
  authority = new WarehouseAuthority(database, 'server', () => time);
  expect((await repo.due(0))[0]?.command.id).toBe('count-one');
  expect(await authority.submit(command())).toEqual(receipt);
  await repo.acknowledge(receipt);
  database.close();
  rmSync(directory, { recursive: true });
});
