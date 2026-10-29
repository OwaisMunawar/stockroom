import {
  StockroomFault,
  type CountRepository,
  type CountTransport,
} from '../../../../shared/contracts';

export interface SyncSummary {
  applied: number;
  conflicts: number;
  deferred: number;
}
export class SyncEngine {
  private active: Promise<SyncSummary> | null = null;
  constructor(
    private readonly repository: CountRepository,
    private readonly transport: CountTransport,
    private readonly clock: () => number,
  ) {}
  sync(): Promise<SyncSummary> {
    if (this.active) return this.active;
    this.active = this.perform().finally(() => {
      this.active = null;
    });
    return this.active;
  }
  private async perform(): Promise<SyncSummary> {
    const summary: SyncSummary = { applied: 0, conflicts: 0, deferred: 0 };
    for (const count of await this.repository.due(this.clock())) {
      try {
        const result = await this.transport.submit(count.command);
        await this.repository.acknowledge(result);
        if (result.kind === 'applied') summary.applied++;
        else summary.conflicts++;
      } catch (error) {
        if (error instanceof StockroomFault && error.code !== 'NETWORK') throw error;
        await this.repository.defer(
          count.command.id,
          this.clock(),
          'Connection lost; the command ID is retained.',
        );
        summary.deferred++;
      }
    }
    await this.repository.mergeCatalog(await this.transport.catalog());
    return summary;
  }
}
