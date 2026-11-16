import { describe, expect, test } from 'vitest';
import { createWorkerFetch } from './workerFetch';
import { serveRequests } from './workerHandler';

const setup = (handler: (r: Request) => Response | Promise<Response>) => {
  const { port1, port2 } = new MessageChannel();
  port1.start();
  port2.start();
  serveRequests(port2, handler);
  return createWorkerFetch(port1);
};

describe('worker fetch transport', () => {
  test('round-trips status, headers and json body', async () => {
    const f = setup(async r => {
      const body = await r.json();
      return Response.json(
        { echo: body, method: r.method },
        { status: 201, headers: { 'x-a': '1' } }
      );
    });
    const res = await f('http://localhost/api/x', {
      method: 'POST',
      body: JSON.stringify({ a: 1 })
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('x-a')).toBe('1');
    expect(await res.json()).toEqual({ echo: { a: 1 }, method: 'POST' });
  });

  test('passes error statuses through', async () => {
    const f = setup(() => new Response('nope', { status: 404 }));
    const res = await f('http://localhost/api/x');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('nope');
  });

  test('handler exceptions become 500', async () => {
    const f = setup(() => {
      throw new Error('boom');
    });
    expect((await f('http://localhost/api/x')).status).toBe(500);
  });

  test('null-body statuses work', async () => {
    const f = setup(() => new Response(null, { status: 204 }));
    expect((await f('http://localhost/api/x')).status).toBe(204);
  });

  test('streams chunks incrementally', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const enc = new TextEncoder();
    const f = setup(
      () =>
        new Response(
          new ReadableStream({
            async start(c) {
              c.enqueue(enc.encode('one'));
              await gate;
              c.enqueue(enc.encode('two'));
              c.close();
            }
          })
        )
    );
    const res = await f('http://localhost/api/x');
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    expect(dec.decode((await reader.read()).value)).toBe('one');
    release();
    expect(dec.decode((await reader.read()).value)).toBe('two');
    expect((await reader.read()).done).toBe(true);
  });

  test('abort cancels the in-flight stream', async () => {
    let cancelled = false;
    const f = setup(
      r =>
        new Response(
          new ReadableStream({
            start: c => c.enqueue(new Uint8Array([1])),
            cancel: () => {
              cancelled = true;
            }
          }),
          { headers: { 'x-sig': String(r.signal.aborted) } }
        )
    );
    const ctrl = new AbortController();
    const res = await f('http://localhost/api/x', { signal: ctrl.signal });
    const reader = res.body!.getReader();
    await reader.read();
    ctrl.abort();
    await expect(reader.read()).rejects.toBeDefined();
    await new Promise(r => setTimeout(r, 20));
    expect(cancelled).toBe(true);
  });
});
