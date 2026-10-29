import {
  OnDeviceParser,
  RulesParser,
  type NativeCountModule,
} from '../../src/features/counts/data/draftParser';
import { sampleCatalog } from '../../shared/catalog';

function module(value: unknown): NativeCountModule {
  return { available: () => true, parseCount: async () => value };
}
test('native parser checks numeric quantity and catalog identity before review', async () => {
  expect(
    (
      await new OnDeviceParser(module({ productIndex: 0, quantity: 14 })).parse(
        '14 brass adapters',
        sampleCatalog,
      )
    ).origin,
  ).toBe('on-device');
  expect((await new RulesParser().parse('14 brass adapters', sampleCatalog)).origin).toBe('rules');
});
test.each([
  { productIndex: 0, quantity: 99 },
  { productIndex: 1, quantity: 14 },
  { productIndex: 0, quantity: 14, extra: 'untrusted' },
  null,
])('rejects malformed or ungrounded native output: %j', async (value) => {
  await expect(
    new OnDeviceParser(module(value)).parse('14 brass adapters', sampleCatalog),
  ).rejects.toThrow();
});
test('invalid notes do not invoke the native model', async () => {
  const native = module({});
  native.parseCount = jest.fn();
  const parser = new OnDeviceParser(native);
  await expect(parser.parse('14 unknown objects', sampleCatalog)).rejects.toThrow('Name exactly');
  await expect(parser.parse('14.5 brass adapters', sampleCatalog)).rejects.toThrow();
  expect(native.parseCount).not.toHaveBeenCalled();
});
test('unavailable and timed-out generation remain explicit model failures', async () => {
  await expect(
    new OnDeviceParser({
      available: () => true,
      parseCount: async () => {
        throw new Error('unavailable');
      },
    }).parse('14 brass adapters', sampleCatalog),
  ).rejects.toThrow('could not finish');
  await expect(
    new OnDeviceParser(
      { available: () => true, parseCount: () => new Promise(() => {}) },
      10,
    ).parse('14 brass adapters', sampleCatalog),
  ).rejects.toThrow('timed out');
});
