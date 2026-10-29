import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { CountTransport } from '../shared/contracts';
import { commandSchema, parseInput, StockroomFault } from '../shared/contracts';

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    bytes += value.length;
    if (bytes > 16_384) throw new StockroomFault('INVALID_INPUT', 'Request body is too large.');
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new StockroomFault('INVALID_INPUT', 'Request body must be JSON.');
  }
}
export function createCountServer(authority: CountTransport): Server {
  return createServer((request, response) => {
    const send = (status: number, value: unknown): void => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(JSON.stringify(value));
    };
    void (async () => {
      try {
        if (request.method === 'GET' && request.url === '/health') {
          send(200, { status: 'ok' });
          return;
        }
        if (request.method === 'GET' && request.url === '/v1/catalog') {
          send(200, await authority.catalog());
          return;
        }
        if (request.method === 'POST' && request.url === '/v1/counts') {
          if (!request.headers['content-type']?.startsWith('application/json')) {
            send(415, { code: 'INVALID_INPUT', message: 'Use application/json.' });
            return;
          }
          send(200, await authority.submit(parseInput(commandSchema, await body(request))));
          return;
        }
        send(404, { code: 'NOT_FOUND', message: 'Route not found.' });
      } catch (error) {
        const failure = error instanceof StockroomFault ? error : null;
        const status =
          failure?.code === 'NOT_FOUND'
            ? 404
            : failure?.code === 'IDEMPOTENCY_MISMATCH'
              ? 409
              : failure?.code === 'INVALID_INPUT'
                ? 400
                : 500;
        send(status, {
          code: failure?.code ?? 'INTERNAL',
          message: failure?.message ?? 'The server could not finish this request.',
        });
      }
    })();
  });
}
