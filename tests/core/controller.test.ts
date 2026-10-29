import { InventoryController } from '../../src/features/counts/application/controller';
import { parseWithRules } from '../../shared/counts';
import { StockroomFault, type DraftParser } from '../../shared/contracts';
import { sampleCatalog } from '../../shared/catalog';
import { command, fixture, product, time } from '../support';

let context: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  context = await fixture();
});
afterEach(() => context.close());
function controller(mode: 'demo' | 'http' = 'demo', model: DraftParser | null = null) {
  let id = 0;
  return new InventoryController({
    repository: context.repository,
    transport: context.authority,
    rules: { parse: async (note, products) => parseWithRules(note, products) },
    model,
    now: () => new Date(time),
    id: () => `controller-${++id}`,
    mode,
  });
}
test('reviewed note count queues offline, conflicts and is deliberately recounted', async () => {
  const app = controller();
  await app.load();
  let changes = 0;
  const unsubscribe = app.subscribe(() => changes++);
  expect(await app.sync()).toBe(false);
  expect(app.getSnapshot().error).toContain('offline');
  app.clearError();
  expect(await app.queueDraft()).toBe(false);
  expect(await app.prepareDraft('14 brass adapters')).toBe(true);
  expect(await app.queueDraft()).toBe(true);
  await app.simulateCompetingCount(product);
  app.setOnline(true);
  expect(await app.sync()).toBe(true);
  const conflict = app.getSnapshot().snapshot.counts[0]!;
  expect(conflict.state).toBe('conflict');
  expect(await app.resolve(conflict, 'recount', 'Counted the shelf again')).toBe(true);
  expect(await app.sync()).toBe(true);
  expect(app.getSnapshot().snapshot.products.find((p) => p.id === product.id)?.onHand).toBe(14);
  expect(changes).toBeGreaterThan(5);
  unsubscribe();
});
test('manual entry validates quantity and keep-server decisions retain original history', async () => {
  const app = controller();
  await app.load();
  expect(await app.prepareManual(product.id, '')).toBe(false);
  expect(await app.prepareManual('missing', '1')).toBe(false);
  expect(await app.prepareManual(product.id, '14')).toBe(true);
  await app.queueDraft();
  await app.simulateCompetingCount(product);
  app.setOnline(true);
  await app.sync();
  expect(
    await app.resolve(
      app.getSnapshot().snapshot.counts[0]!,
      'keep-server',
      'Accepted the remote recount',
    ),
  ).toBe(true);
  expect(app.getSnapshot().snapshot.counts[0]?.state).toBe('cancelled');
});
test('a busy draft cannot queue or change modes; unknown parser failures remain visible', async () => {
  let finish: ((draft: ReturnType<typeof parseWithRules>) => void) | undefined;
  const pending = new Promise<ReturnType<typeof parseWithRules>>((resolve) => {
    finish = resolve;
  });
  const app = controller('demo', { parse: () => pending });
  await app.load();
  expect(app.modelAvailable).toBe(true);
  const preparing = app.prepareDraft('14 brass adapters');
  app.setOnline(true);
  app.setModel(false);
  expect(app.getSnapshot().online).toBe(false);
  expect(await app.queueDraft()).toBe(false);
  finish?.(parseWithRules('14 brass adapters', sampleCatalog));
  expect(await preparing).toBe(true);
  app.setModel(false);
  expect(app.getSnapshot().modelEnabled).toBe(false);
  const broken = controller('demo', {
    parse: async () => {
      throw new Error('failure');
    },
  });
  await broken.load();
  expect(await broken.prepareDraft('14 brass adapters')).toBe(false);
  expect(broken.getSnapshot().error).toContain('Reload');
});
test('HTTP mode refuses fixture mutations and paused delivery can be resumed', async () => {
  const app = controller('http');
  await app.load();
  expect(app.mode).toBe('http');
  expect(await app.simulateCompetingCount(product)).toBe(false);
  await context.repository.enqueue(command());
  for (let attempt = 0; attempt < 5; attempt++)
    await context.repository.defer('count-one', 0, 'network');
  expect(await app.retry('count-one')).toBe(true);
  const unavailable = controller('http', {
    parse: async () => {
      throw new StockroomFault('MODEL', 'Unavailable');
    },
  });
  await unavailable.load();
  expect(await unavailable.prepareDraft('14 brass adapters')).toBe(false);
  expect(unavailable.getSnapshot().error).toBe('Unavailable');
});
