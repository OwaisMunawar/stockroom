import { SyncEngine } from '../../src/features/counts/application/syncEngine';
import { StockroomFault, type CountTransport } from '../../shared/contracts';
import { command, fixture } from '../support';

let context: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  context = await fixture();
});
afterEach(() => context.close());
test('lost acknowledgement reuses the receipt and cannot change stock twice', async () => {
  await context.repository.enqueue(command());
  let lost = true;
  let now = 0;
  const transport: CountTransport = {
    catalog: () => context.authority.catalog(),
    submit: async (input) => {
      const result = await context.authority.submit(input);
      if (lost) {
        lost = false;
        throw new StockroomFault('NETWORK', 'lost ack');
      }
      return result;
    },
  };
  const sync = new SyncEngine(context.repository, transport, () => now);
  expect((await sync.sync()).deferred).toBe(1);
  now = 100000;
  expect((await sync.sync()).applied).toBe(1);
  expect((await context.authority.catalog()).find((p) => p.id === 'brass-adapter')?.version).toBe(
    2,
  );
});
test('one failed item does not block a different product; sync calls share one flight', async () => {
  await context.repository.enqueue(command());
  await context.repository.enqueue({ ...command('copper-count', 20), productId: 'copper-elbow' });
  const transport: CountTransport = {
    catalog: () => context.authority.catalog(),
    submit: async (input) => {
      if (input.id === 'count-one') throw new Error('connection');
      return context.authority.submit(input);
    },
  };
  const sync = new SyncEngine(context.repository, transport, () => 0);
  const first = sync.sync();
  expect(sync.sync()).toBe(first);
  expect(await first).toEqual({ applied: 1, conflicts: 0, deferred: 1 });
});
test('conflicts stop automatic retries and validation faults remain visible', async () => {
  await context.repository.enqueue(command());
  await context.authority.submit(command('remote-count', 12));
  const sync = new SyncEngine(context.repository, context.authority, () => 0);
  expect((await sync.sync()).conflicts).toBe(1);
  expect((await sync.sync()).conflicts).toBe(0);
  await context.repository.enqueue({ ...command('copper-count', 20), productId: 'copper-elbow' });
  const invalid = new SyncEngine(
    context.repository,
    {
      catalog: () => context.authority.catalog(),
      submit: async () => {
        throw new StockroomFault('INVALID_INPUT', 'invalid');
      },
    },
    () => 0,
  );
  await expect(invalid.sync()).rejects.toThrow('invalid');
});
