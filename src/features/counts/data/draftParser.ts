import { z } from 'zod';
import {
  parseInput,
  StockroomFault,
  type CountDraft,
  type DraftParser,
  type Product,
} from '../../../../shared/contracts';
import {
  groundDraft,
  parseWithRules,
  sourceQuantity,
  mentionedProducts,
} from '../../../../shared/counts';

export interface NativeCountModule {
  available(): boolean;
  parseCount(note: string, catalog: string): Promise<unknown>;
}
const selectionSchema = z
  .object({
    productIndex: z.number().int().min(0).max(99),
    quantity: z.number().int().min(0).max(1_000_000),
  })
  .strict();
export class RulesParser implements DraftParser {
  async parse(note: string, products: readonly Product[]): Promise<CountDraft> {
    return parseWithRules(note, products);
  }
}
export class OnDeviceParser implements DraftParser {
  constructor(
    private readonly module: NativeCountModule,
    private readonly timeout = 30_000,
  ) {}
  async parse(note: string, products: readonly Product[]): Promise<CountDraft> {
    sourceQuantity(note);
    if (mentionedProducts(note, products).length !== 1)
      throw new StockroomFault('INVALID_INPUT', 'Name exactly one catalog product or SKU.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const selection = parseInput(
        selectionSchema,
        await Promise.race([
          this.module.parseCount(
            note,
            JSON.stringify(products.map((p, index) => ({ index, name: p.name, sku: p.sku }))),
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new StockroomFault('MODEL', 'The local model timed out. Use the rules parser.'),
                ),
              this.timeout,
            );
          }),
        ]),
      );
      return groundDraft(note, products, selection, 'on-device');
    } catch (error) {
      if (error instanceof StockroomFault) throw error;
      throw new StockroomFault(
        'MODEL',
        'The local model could not finish. Use the rules parser or enter a manual count.',
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
