import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InventoryApp } from '../../src/ui/InventoryApp';
import { InventoryController } from '../../src/features/counts/application/controller';
import { groundDraft, parseWithRules } from '../../shared/counts';
import { fixture, product, time } from '../support';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
let context: Awaited<ReturnType<typeof fixture>>;
let app: InventoryController;
beforeEach(async () => {
  context = await fixture();
  let id = 0;
  app = new InventoryController({
    repository: context.repository,
    transport: context.authority,
    rules: { parse: async (note, products) => parseWithRules(note, products) },
    model: {
      parse: async (note, products) =>
        groundDraft(
          note,
          products,
          { productIndex: products.findIndex((p) => p.id === product.id), quantity: 14 },
          'on-device',
        ),
    },
    now: () => new Date(time),
    id: () => `widget-${++id}`,
    mode: 'demo',
  });
  await app.load();
});
afterEach(() => context.close());
test('catalog search and product entry show stock rather than pending observations', async () => {
  await render(<InventoryApp controller={app} />);
  await fireEvent.changeText(screen.getByTestId('catalog-search'), 'brass');
  expect(screen.queryByText('Copper elbows')).toBeNull();
  await fireEvent.press(screen.getByTestId('product-brass-adapter'));
  expect(screen.getByTestId('count-note').props.value).toContain('18 Brass adapters');
});
test('a native-labelled draft needs explicit acceptance and remains queued while offline', async () => {
  await render(<InventoryApp controller={app} />);
  await fireEvent.press(screen.getByTestId('tab-count'));
  await fireEvent.press(screen.getByTestId('parse-count'));
  expect(await screen.findByText('ON-DEVICE AI')).toBeTruthy();
  expect(app.getSnapshot().snapshot.counts).toHaveLength(0);
  await fireEvent.press(screen.getByTestId('queue-count'));
  expect(await screen.findByText('QUEUED ON THIS DEVICE')).toBeTruthy();
  expect(screen.getByTestId('sync-now').props.accessibilityState.disabled).toBe(true);
  await fireEvent(screen.getByTestId('online-switch'), 'valueChange', true);
  await fireEvent.press(screen.getByTestId('sync-now'));
  await waitFor(() => expect(app.getSnapshot().snapshot.counts[0]?.state).toBe('synced'));
  await fireEvent.press(screen.getByTestId('tab-ledger'));
  expect(screen.getByText('1 SERVER-CONFIRMED COUNT')).toBeTruthy();
});
test('conflict review requires a note and leaves a supersession trail', async () => {
  await app.prepareManual(product.id, '14');
  await app.queueDraft();
  await app.simulateCompetingCount(product);
  app.setOnline(true);
  await app.sync();
  await render(<InventoryApp controller={app} />);
  await fireEvent.press(screen.getByTestId('tab-outbox'));
  expect(screen.getByText('REVISION CONFLICT')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('requeue-count'));
  expect(
    await screen.findByText('Explain the conflict decision in 3–400 characters.'),
  ).toBeTruthy();
  await fireEvent.changeText(
    screen.getByTestId('conflict-note'),
    'Recounted this shelf against the saved server revision.',
  );
  await fireEvent.press(screen.getByTestId('requeue-count'));
  await waitFor(() =>
    expect(app.getSnapshot().snapshot.counts.some((c) => c.state === 'superseded')).toBe(true),
  );
  expect(screen.getByText('QUEUED ON THIS DEVICE')).toBeTruthy();
});
test('manual count review and a report preview preserve server-only quantities', async () => {
  await render(<InventoryApp controller={app} />);
  await fireEvent.press(screen.getByTestId('tab-count'));
  await fireEvent.press(screen.getByText('Switch to manual entry'));
  await fireEvent.changeText(screen.getByLabelText('Manual quantity'), '14');
  await fireEvent.press(screen.getByTestId('manual-review'));
  expect(await screen.findByText('MANUAL ENTRY')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('tab-ledger'));
  await fireEvent.press(screen.getByTestId('preview-report'));
  expect(screen.getByTestId('report-data').props.children).toContain('"18","1"');
});
