import {
  catalogSchema,
  parseInput,
  resultSchema,
  StockroomFault,
  type CountCommand,
  type CountTransport,
  type Product,
  type SubmitResult,
} from '../../../../shared/contracts';

export class HttpTransport implements CountTransport {
  constructor(
    private readonly origin: string,
    private readonly request: typeof fetch = fetch,
    private readonly timeout = 8000,
  ) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/'
    )
      throw new StockroomFault(
        'INVALID_INPUT',
        'Use an HTTP(S) server origin without credentials or a path.',
      );
  }
  private async send(path: string, command?: CountCommand): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.request(`${this.origin.replace(/\/$/, '')}${path}`, {
        method: command ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...(command ? { body: JSON.stringify(command) } : {}),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status >= 500)
          throw new StockroomFault('NETWORK', 'The reference server is unavailable.');
        throw new StockroomFault('INVALID_INPUT', 'The reference server rejected this count.');
      }
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof StockroomFault) throw error;
      throw new StockroomFault('NETWORK', 'The reference server could not be reached.');
    } finally {
      clearTimeout(timer);
    }
  }
  async catalog(): Promise<Product[]> {
    return parseInput(catalogSchema, await this.send('/v1/catalog'));
  }
  async submit(command: CountCommand): Promise<SubmitResult> {
    return parseInput(resultSchema, await this.send('/v1/counts', command));
  }
}
