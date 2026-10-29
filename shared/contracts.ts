import { z } from 'zod';

export type FaultCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_MISMATCH'
  | 'BLOCKED'
  | 'NETWORK'
  | 'STORAGE'
  | 'MODEL';
export class StockroomFault extends Error {
  constructor(
    readonly code: FaultCode,
    message: string,
  ) {
    super(message);
    this.name = 'StockroomFault';
  }
}
const identifier = z.string().regex(/^[a-zA-Z0-9-]{3,80}$/);
export const productSchema = z
  .object({
    id: identifier,
    sku: z.string().min(1).max(40),
    name: z.string().min(1).max(100),
    aliases: z.array(z.string().min(2).max(80)).min(1).max(8),
    bin: z.string().min(1).max(30),
    unit: z.string().min(1).max(20),
    onHand: z.number().int().min(0).max(1_000_000),
    version: z.number().int().min(1),
    threshold: z.number().int().nonnegative(),
  })
  .strict();
export type Product = z.infer<typeof productSchema>;
export const originSchema = z.enum(['on-device', 'rules', 'manual']);
export const commandSchema = z
  .object({
    id: identifier,
    productId: identifier,
    baseVersion: z.number().int().positive(),
    quantity: z.number().int().min(0).max(1_000_000),
    note: z.string().trim().min(3).max(400),
    origin: originSchema,
    createdAt: z.iso.datetime(),
    supersedesId: identifier.nullable(),
  })
  .strict();
export type CountCommand = z.infer<typeof commandSchema>;
export const resultSchema = z
  .object({
    kind: z.enum(['applied', 'conflict']),
    commandId: identifier,
    product: productSchema,
    recordedAt: z.iso.datetime(),
  })
  .strict();
export type SubmitResult = z.infer<typeof resultSchema>;
export const catalogSchema = z.array(productSchema).max(2000);
export type CountState = 'queued' | 'synced' | 'conflict' | 'superseded' | 'cancelled' | 'failed';
export interface CountRecord {
  command: CountCommand;
  state: CountState;
  attempts: number;
  nextAttemptAt: number;
  error: string | null;
  remote: Product | null;
}
export interface CountEvent {
  id: number;
  commandId: string;
  kind: string;
  note: string;
  at: string;
}
export interface Snapshot {
  products: Product[];
  counts: CountRecord[];
  events: CountEvent[];
}
export interface SqlDriver {
  run(sql: string, params?: readonly (string | number | null)[]): Promise<number>;
  all(
    sql: string,
    params?: readonly (string | number | null)[],
  ): Promise<Record<string, unknown>[]>;
  transaction<T>(work: (sql: SqlDriver) => Promise<T>): Promise<T>;
}
export interface CountRepository {
  initialize(products: readonly Product[]): Promise<void>;
  snapshot(): Promise<Snapshot>;
  enqueue(command: CountCommand): Promise<void>;
  due(at: number): Promise<CountRecord[]>;
  acknowledge(result: SubmitResult): Promise<void>;
  defer(id: string, at: number, message: string): Promise<void>;
  mergeCatalog(products: Product[]): Promise<void>;
  resolve(
    id: string,
    decision: 'recount' | 'keep-server',
    replacement: CountCommand | null,
    note: string,
    at: string,
  ): Promise<void>;
  retry(id: string): Promise<void>;
}
export interface CountTransport {
  catalog(): Promise<Product[]>;
  submit(command: CountCommand): Promise<SubmitResult>;
}
export interface DraftParser {
  parse(note: string, products: readonly Product[]): Promise<CountDraft>;
}
export interface CountDraft {
  product: Product;
  quantity: number;
  note: string;
  origin: z.infer<typeof originSchema>;
}
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new StockroomFault('INVALID_INPUT', 'The count or source data is invalid.');
  return result.data;
}
export function decodeJson(value: unknown): unknown {
  if (typeof value !== 'string') throw new StockroomFault('STORAGE', 'Stored data is unreadable.');
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new StockroomFault('STORAGE', 'Stored data is unreadable.');
  }
}
