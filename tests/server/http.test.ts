import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createCountServer } from '../../server/http';
import { HttpTransport } from '../../src/features/counts/data/httpTransport';
import { command, fixture } from '../support';

let context: Awaited<ReturnType<typeof fixture>>;
let server: Server;
let origin: string;
beforeEach(async () => {
  context = await fixture();
  server = createCountServer(context.authority);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  context.close();
});
test('real HTTP serves the catalog and durable replay-safe receipts', async () => {
  expect((await fetch(`${origin}/health`)).status).toBe(200);
  const transport = new HttpTransport(origin);
  expect(await transport.catalog()).toHaveLength(6);
  const first = await transport.submit(command());
  expect(await transport.submit(command())).toEqual(first);
  expect((await transport.submit(command('other-device', 12))).kind).toBe('conflict');
  const mismatch = await fetch(`${origin}/v1/counts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command('count-one', 99)),
  });
  expect(mismatch.status).toBe(409);
});
test('invalid routes, content types, bodies and products return typed failures', async () => {
  expect((await fetch(`${origin}/missing`)).status).toBe(404);
  expect((await fetch(`${origin}/v1/counts`, { method: 'POST', body: 'text' })).status).toBe(415);
  expect(
    (
      await fetch(`${origin}/v1/counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(`${origin}/v1/counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(`${origin}/v1/counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command(), productId: 'not-found' }),
      })
    ).status,
  ).toBe(404);
  await expect(new HttpTransport(origin).submit({ ...command(), quantity: -1 })).rejects.toThrow(
    'rejected',
  );
});
test('transport validates its origin, schemas, server failures and connection failures', async () => {
  expect(() => new HttpTransport('file:///tmp')).toThrow();
  expect(() => new HttpTransport('https://user:pass@example.org')).toThrow();
  expect(() => new HttpTransport('https://example.org/path')).toThrow();
  const mock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  mock.mockResolvedValue(new Response('{}', { status: 500 }));
  await expect(new HttpTransport(origin, mock).catalog()).rejects.toThrow('unavailable');
  mock.mockRejectedValue(new Error('connection'));
  await expect(new HttpTransport(origin, mock).catalog()).rejects.toThrow('reached');
  mock.mockResolvedValue(new Response('{}', { status: 200 }));
  await expect(new HttpTransport(origin, mock).catalog()).rejects.toThrow('invalid');
});
