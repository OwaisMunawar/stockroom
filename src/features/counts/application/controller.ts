import { makeCommand, reviewNote } from '../../../../shared/counts';
import {
  StockroomFault,
  type CountDraft,
  type CountRecord,
  type CountRepository,
  type CountTransport,
  type DraftParser,
  type Product,
  type Snapshot,
} from '../../../../shared/contracts';
import { SyncEngine } from './syncEngine';

export interface InventoryState {
  snapshot: Snapshot;
  busy: boolean;
  error: string | null;
  notice: string | null;
  draft: CountDraft | null;
  online: boolean;
  modelEnabled: boolean;
}
export interface ControllerOptions {
  repository: CountRepository;
  transport: CountTransport;
  rules: DraftParser;
  model: DraftParser | null;
  now: () => Date;
  id: () => string;
  mode: 'demo' | 'http';
}
export class InventoryController {
  private value: InventoryState = {
    snapshot: { products: [], counts: [], events: [] },
    busy: false,
    error: null,
    notice: null,
    draft: null,
    online: false,
    modelEnabled: false,
  };
  private readonly listeners = new Set<() => void>();
  private readonly engine: SyncEngine;
  constructor(private readonly options: ControllerOptions) {
    this.value = { ...this.value, modelEnabled: options.model !== null };
    const transport: CountTransport = {
      catalog: () => {
        this.requireOnline();
        return options.transport.catalog();
      },
      submit: (command) => {
        this.requireOnline();
        return options.transport.submit(command);
      },
    };
    this.engine = new SyncEngine(options.repository, transport, () => options.now().getTime());
  }
  readonly getSnapshot = (): InventoryState => this.value;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  get mode(): 'demo' | 'http' {
    return this.options.mode;
  }
  get modelAvailable(): boolean {
    return this.options.model !== null;
  }
  private requireOnline(): void {
    if (!this.value.online)
      throw new StockroomFault('NETWORK', 'Working offline. Counts stay queued on this device.');
  }
  private update(change: Partial<InventoryState>): void {
    this.value = { ...this.value, ...change };
    for (const listener of this.listeners) listener();
  }
  private async refresh(): Promise<void> {
    this.update({ snapshot: await this.options.repository.snapshot() });
  }
  async load(): Promise<void> {
    await this.refresh();
  }
  clearError(): void {
    this.update({ error: null });
  }
  setOnline(online: boolean): void {
    if (!this.value.busy) this.update({ online, notice: null, error: null });
  }
  setModel(enabled: boolean): void {
    if (!this.value.busy) this.update({ modelEnabled: enabled && this.modelAvailable });
  }
  private async run(work: () => Promise<void>): Promise<boolean> {
    if (this.value.busy) return false;
    this.update({ busy: true, error: null, notice: null });
    try {
      await work();
      return true;
    } catch (error) {
      this.update({
        error:
          error instanceof StockroomFault
            ? error.message
            : 'The operation could not finish. Reload the notebook before retrying.',
      });
      return false;
    } finally {
      this.update({ busy: false });
    }
  }
  prepareDraft(note: string): Promise<boolean> {
    return this.run(async () => {
      const parser = this.value.modelEnabled ? this.options.model : this.options.rules;
      if (!parser)
        throw new StockroomFault(
          'MODEL',
          'The local model is unavailable. Select the rules parser.',
        );
      const draft = await parser.parse(note, this.value.snapshot.products);
      this.update({ draft });
    });
  }
  prepareManual(productId: string, quantity: string): Promise<boolean> {
    return this.run(async () => {
      const product = this.value.snapshot.products.find((p) => p.id === productId);
      if (!product || !/^(0|[1-9]\d{0,5}|1000000)$/.test(quantity))
        throw new StockroomFault(
          'INVALID_INPUT',
          'Choose a product and enter an exact whole count between 0 and 1000000.',
        );
      this.update({
        draft: {
          product,
          quantity: Number(quantity),
          origin: 'manual',
          note: `Manual count: ${quantity} ${product.name} in bin ${product.bin}.`,
        },
      });
    });
  }
  queueDraft(): Promise<boolean> {
    return this.run(async () => {
      const draft = this.value.draft;
      if (!draft) throw new StockroomFault('BLOCKED', 'Review a count draft first.');
      await this.options.repository.enqueue(
        makeCommand(draft, this.options.id(), this.options.now().toISOString()),
      );
      await this.refresh();
      this.update({
        draft: null,
        notice: 'Count saved locally. Server stock changes only after a receipt.',
      });
    });
  }
  sync(): Promise<boolean> {
    return this.run(async () => {
      this.requireOnline();
      try {
        const result = await this.engine.sync();
        this.update({
          notice: `${result.applied} applied · ${result.conflicts} conflicts · ${result.deferred} deferred`,
        });
      } finally {
        await this.refresh();
      }
    });
  }
  resolve(count: CountRecord, decision: 'recount' | 'keep-server', note: string): Promise<boolean> {
    return this.run(async () => {
      const reviewedNote = reviewNote(note);
      const server = this.value.snapshot.products.find((p) => p.id === count.command.productId);
      if (!server)
        throw new StockroomFault('NOT_FOUND', 'Reload the catalog before resolving this count.');
      const replacement =
        decision === 'recount'
          ? makeCommand(
              {
                product: server,
                quantity: count.command.quantity,
                note: reviewedNote,
                origin: 'manual',
              },
              this.options.id(),
              this.options.now().toISOString(),
              count.command.id,
            )
          : null;
      await this.options.repository.resolve(
        count.command.id,
        decision,
        replacement,
        reviewedNote,
        this.options.now().toISOString(),
      );
      await this.refresh();
      this.update({
        notice:
          decision === 'recount'
            ? 'Reviewed recount queued against the displayed revision.'
            : 'Server count kept. The original count remains in history.',
      });
    });
  }
  retry(id: string): Promise<boolean> {
    return this.run(async () => {
      await this.options.repository.retry(id);
      await this.refresh();
    });
  }
  async simulateCompetingCount(product: Product): Promise<boolean> {
    return this.run(async () => {
      if (this.mode !== 'demo')
        throw new StockroomFault(
          'BLOCKED',
          'Competing-device simulation is available only in the local demo warehouse.',
        );
      await this.options.transport.submit(
        makeCommand(
          {
            product,
            quantity: Math.max(0, product.onHand - 2),
            note: 'Demo second-device cycle count.',
            origin: 'manual',
          },
          this.options.id(),
          this.options.now().toISOString(),
        ),
      );
      this.update({
        notice: 'Demo second device changed the server count. Sync to compare revisions.',
      });
    });
  }
}
