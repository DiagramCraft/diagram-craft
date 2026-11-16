import { setApiTransport } from '../lib/apiTransport';
import { createWorkerFetch } from './workerFetch';
import type { FromWorkerMessage, ToWorkerMessage } from './workerProtocol';

const DEMO_USER = { username: 'globaladmin', password: 'test' };

/** Adds `Authorization: Bearer` to every request; re-logs in once on a 401. */
export const withBearerAuth = (inner: typeof fetch, login: () => Promise<string>): typeof fetch => {
  let token: string | null = null;
  const send = async (input: RequestInfo | URL, init: RequestInit | undefined, tok: string) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    headers.set('Authorization', `Bearer ${tok}`);
    return inner(input, { ...init, headers });
  };
  return async (input, init) => {
    token ??= await login();
    const res = await send(input, init, token);
    if (res.status !== 401) return res;
    token = await login();
    return send(input, init, token);
  };
};

const waitForReady = (worker: Worker) =>
  new Promise<void>((resolve, reject) => {
    const onMessage = (e: MessageEvent<FromWorkerMessage>) => {
      if (e.data.type !== 'ready') return;
      worker.removeEventListener('message', onMessage);
      resolve();
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', e => reject(new Error(e.message)), { once: true });
  });

/** Starts the in-browser server Worker and routes `/api` through it, signed in as the demo admin. */
export const startLocalServer = async () => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  await waitForReady(worker);

  const raw = createWorkerFetch(worker);
  const login = async () => {
    const res = await raw('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DEMO_USER)
    });
    if (!res.ok) throw new Error(`Demo login failed (${res.status})`);
    const body = (await res.json()) as { access_token?: string; json?: { access_token?: string } };
    const token = body.access_token ?? body.json?.access_token;
    if (!token) throw new Error('Demo login returned no access token');
    return token;
  };

  setApiTransport(withBearerAuth(raw, login));

  // Persist unsaved changes when the page is hidden or closed
  const flush = () => worker.postMessage({ type: 'flush' } satisfies ToWorkerMessage);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  activeWorker = worker;
  return worker;
};

let activeWorker: Worker | null = null;

/** Discards the persisted demo data and reloads, which re-seeds the demo. */
export const resetDemo = async () => {
  const worker = activeWorker;
  if (worker) {
    await new Promise<void>(resolve => {
      const onMessage = (e: MessageEvent<FromWorkerMessage>) => {
        if (e.data.type !== 'reset-done') return;
        worker.removeEventListener('message', onMessage);
        resolve();
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'reset' } satisfies ToWorkerMessage);
    });
  }
  window.location.reload();
};
