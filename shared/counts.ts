import {
  commandSchema,
  parseInput,
  StockroomFault,
  type CountCommand,
  type CountDraft,
  type Product,
  type SubmitResult,
} from './contracts';

export function makeCommand(
  draft: CountDraft,
  id: string,
  at: string,
  supersedesId: string | null = null,
): CountCommand {
  return parseInput(commandSchema, {
    id,
    productId: draft.product.id,
    baseVersion: draft.product.version,
    quantity: draft.quantity,
    note: draft.note,
    origin: draft.origin,
    createdAt: at,
    supersedesId,
  });
}
export function applyCount(product: Product, command: CountCommand, at: string): SubmitResult {
  if (command.productId !== product.id)
    throw new StockroomFault('NOT_FOUND', 'This product no longer exists.');
  return {
    kind: command.baseVersion === product.version ? 'applied' : 'conflict',
    commandId: command.id,
    product:
      command.baseVersion === product.version
        ? { ...product, onHand: command.quantity, version: product.version + 1 }
        : product,
    recordedAt: at,
  };
}
export function commandFingerprint(command: CountCommand): string {
  // Explicit field order makes receipt identity independent of incoming JSON key order.
  return JSON.stringify([
    command.id,
    command.productId,
    command.baseVersion,
    command.quantity,
    command.note,
    command.origin,
    command.createdAt,
    command.supersedesId,
  ]);
}
export function retryDelay(attempt: number, id: string): number {
  const jitter = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 251;
  return Math.min(60_000, 1000 * 2 ** Math.min(Math.max(attempt - 1, 0), 6)) + jitter;
}
function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export function mentionedProducts(note: string, products: readonly Product[]): Product[] {
  const source = ` ${normalized(note)} `;
  return products.filter((product) =>
    product.aliases.some((alias) => source.includes(` ${normalized(alias)} `)),
  );
}
export function sourceQuantity(note: string): number {
  if (
    note.trim().length < 3 ||
    note.length > 400 ||
    /\b(about|roughly|maybe|approximately|between)\b/i.test(note) ||
    /(?:^|\s)-\d/.test(note)
  ) {
    throw new StockroomFault(
      'INVALID_INPUT',
      'Use one exact, non-negative whole count and one product.',
    );
  }
  const matches = [...note.matchAll(/(?:^|[^\w.-])(\d+(?:[.,]\d+)?)(?=$|[^\w.])/g)].map(
    (match) => match[1] ?? '',
  );
  if (matches.length !== 1 || !/^(0|[1-9]\d{0,5}|1000000)$/.test(matches[0] ?? '')) {
    throw new StockroomFault(
      'INVALID_INPUT',
      'Use one exact whole quantity; do not include multiple quantities or decimals.',
    );
  }
  return Number(matches[0]);
}
export function groundDraft(
  note: string,
  products: readonly Product[],
  selection: { productIndex: number; quantity: number },
  origin: CountDraft['origin'],
): CountDraft {
  const candidates = mentionedProducts(note, products);
  const product = products[selection.productIndex];
  const quantity = sourceQuantity(note);
  if (
    !Number.isInteger(selection.productIndex) ||
    !product ||
    candidates.length !== 1 ||
    candidates[0]?.id !== product.id ||
    quantity !== selection.quantity
  ) {
    throw new StockroomFault(
      'MODEL',
      'The draft does not match the named product and exact quantity. Edit the note or count manually.',
    );
  }
  return { product, quantity, note: note.trim(), origin };
}
export function parseWithRules(note: string, products: readonly Product[]): CountDraft {
  const candidates = mentionedProducts(note, products);
  if (candidates.length !== 1)
    throw new StockroomFault('INVALID_INPUT', 'Name exactly one catalog product or SKU.');
  return groundDraft(
    note,
    products,
    {
      productIndex: products.findIndex((p) => p.id === candidates[0]?.id),
      quantity: sourceQuantity(note),
    },
    'rules',
  );
}
export function csvReport(products: readonly Product[]): string {
  const escape = (value: string | number): string =>
    `"${(typeof value === 'string' && /^[\s]*[=+\-@]/.test(value) ? "'" + value : String(value)).replace(/"/g, '""')}"`;
  return [
    'sku,name,bin,on_hand,version',
    ...products.map((p) => [p.sku, p.name, p.bin, p.onHand, p.version].map(escape).join(',')),
  ].join('\n');
}

export function reviewNote(note: string): string {
  const value = note.trim();
  if (value.length < 3 || value.length > 400)
    throw new StockroomFault('INVALID_INPUT', 'Explain the conflict decision in 3–400 characters.');
  return value;
}
