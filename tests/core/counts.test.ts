import { sampleCatalog } from '../../shared/catalog';
import {
  applyCount,
  commandFingerprint,
  csvReport,
  groundDraft,
  makeCommand,
  parseWithRules,
  retryDelay,
  sourceQuantity,
} from '../../shared/counts';
import { commandSchema, decodeJson, parseInput, StockroomFault } from '../../shared/contracts';
import { SerialQueue } from '../../shared/serial';
import { command, product, time } from '../support';

describe('grounded count drafts', () => {
  test.each([
    '14 brass adapters in bin B2',
    'Counted 14 BA-014',
    'brass adapter: 14',
    '0 brass adapters',
  ])('grounds exact catalog mention and integer: %s', (note) => {
    expect(parseWithRules(note, sampleCatalog).product.id).toBe(product.id);
  });
  test.each([
    'about 14 brass adapters',
    '-3 brass adapters',
    '14.5 brass adapters',
    '14,5 brass adapters',
    '14 brass adapters and 12 copper elbows',
    'fourteen brass adapters',
    '14 unlisted products',
    '14 brass adapters tomorrow 15',
    '1000001 brass adapters',
    '01 brass adapters',
    '',
  ])('rejects ambiguous/unsupported source: %s', (note) =>
    expect(() => parseWithRules(note, sampleCatalog)).toThrow(StockroomFault),
  );
  test('binds model choices to the exact note, never invented product or quantity', () => {
    expect(
      groundDraft(
        '14 brass adapters',
        sampleCatalog,
        { productIndex: 0, quantity: 14 },
        'on-device',
      ).origin,
    ).toBe('on-device');
    for (const selection of [
      { productIndex: 1, quantity: 14 },
      { productIndex: 0, quantity: 15 },
      { productIndex: 99, quantity: 14 },
      { productIndex: 0.5, quantity: 14 },
    ])
      expect(() => groundDraft('14 brass adapters', sampleCatalog, selection, 'on-device')).toThrow(
        StockroomFault,
      );
    expect(sourceQuantity('1000000 brass adapters')).toBe(1000000);
    expect(() => sourceQuantity('x'.repeat(401))).toThrow();
  });
  test('requires an explicit reviewed command and valid input', () => {
    const draft = parseWithRules('14 brass adapters', sampleCatalog);
    expect(makeCommand(draft, 'count-one', time).baseVersion).toBe(1);
    expect(() => makeCommand(draft, '!', time)).toThrow();
    expect(() => parseInput(commandSchema, { ...command(), quantity: 1.2 })).toThrow();
    expect(() => decodeJson(null)).toThrow();
    expect(() => decodeJson('{')).toThrow();
    expect(decodeJson('{"ok":true}')).toEqual({ ok: true });
  });
});
describe('revision and replay rules', () => {
  test('absolute counts apply once against an exact version', () => {
    const applied = applyCount(product, command(), time);
    expect(applied.product.onHand).toBe(14);
    expect(applied.product.version).toBe(2);
    expect(applyCount(applied.product, command('count-two', 8), time).kind).toBe('conflict');
    expect(() => applyCount({ ...product, id: 'different' }, command(), time)).toThrow();
    expect(commandFingerprint(command())).toBe(commandFingerprint({ ...command() }));
    expect(commandFingerprint(command())).not.toBe(commandFingerprint(command('count-one', 15)));
  });
  test('retry delay is deterministic, bounded and increases before capping', () => {
    expect(retryDelay(2, 'count-one')).toBeGreaterThan(retryDelay(1, 'count-one'));
    expect(retryDelay(100, 'count-one')).toBeLessThanOrEqual(60_250);
    expect(retryDelay(-1, 'count-one')).toBe(retryDelay(1, 'count-one'));
  });
  test('report escapes quotes and carries server revisions rather than local drafts', () => {
    const csv = csvReport([{ ...product, name: 'Brass "adapters"' }]);
    expect(csv).toContain('"Brass ""adapters"""');
    expect(csv).toContain('"18","1"');
  });
  test('serialized failures release the next transaction', async () => {
    const queue = new SerialQueue();
    const order: number[] = [];
    const failed = queue.run(async () => {
      order.push(1);
      throw new Error('failed');
    });
    const next = queue.run(async () => {
      order.push(2);
      return 2;
    });
    await expect(failed).rejects.toThrow();
    await expect(next).resolves.toBe(2);
    expect(order).toEqual([1, 2]);
  });
});
