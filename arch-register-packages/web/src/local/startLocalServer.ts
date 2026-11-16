import { setApiTransport } from '../lib/apiTransport';
import { setAccessTokenExpiryFromSeconds } from '../auth/authClient';
import { createWorkerFetch } from './workerFetch';
import type { FromWorkerMessage, ToWorkerMessage } from './workerProtocol';

const DEMO_USER = { username: 'globaladmin', password: 'test' };
const NEVER_EXPIRES_SECONDS = 10 * 365 * 24 * 3600;

/** What the demo remembers about the visitor's session between page loads */
export type DemoSessionStore = {
  /** A stored access token, 'signed-out' after an explicit logout, or null when never decided */
  read: () => string | null;
  write: (value: string | null) => void;
};

const SIGNED_OUT = 'signed-out';
const SESSION_KEY = 'arch-register-demo-session';

export const localStorageSessionStore: DemoSessionStore = {
  read: () => {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  write: value => {
    try {
      if (value === null) localStorage.removeItem(SESSION_KEY);
      else localStorage.setItem(SESSION_KEY, value);
    } catch {
      // not persisted
    }
  }
};

const pathOf = (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(url, 'http://localhost').pathname.replace(/\/+$/, '');
};

const extractToken = async (res: Response) => {
  const body = (await res
    .clone()
    .json()
    .catch(() => ({}))) as { access_token?: string; json?: { access_token?: string } };
  return body.access_token ?? body.json?.access_token ?? null;
};

/**
 * Stands in for the session cookie, which the in-process transport cannot keep. A first-time visitor is
 * signed in automatically as the demo admin (`autoLogin`, re-done on a 401). An explicit login or logout
 * is remembered in `store`, so a reload keeps the visitor signed in as that user, or signed out.
 */
export const withBearerAuth = (
  inner: typeof fetch,
  autoLogin: () => Promise<string>,
  store: DemoSessionStore = { read: () => null, write: () => {} }
): typeof fetch => {
  const stored = store.read();
  let signedOut = stored === SIGNED_OUT;
  let token: string | null = stored && !signedOut ? stored : null;
  let isAuto = false;

  const send = (input: RequestInfo | URL, init: RequestInit | undefined, tok: string | null) => {
    if (!tok) return inner(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    headers.set('Authorization', `Bearer ${tok}`);
    return inner(input, { ...init, headers });
  };

  return async (input, init) => {
    const path = pathOf(input);

    if (path === '/api/auth/login') {
      const res = await send(input, init, null);
      const tok = res.ok ? await extractToken(res) : null;
      if (tok) {
        token = tok;
        isAuto = false;
        signedOut = false;
        store.write(tok);
      }
      return res;
    }

    if (path === '/api/auth/logout') {
      const res = await send(input, init, token);
      token = null;
      signedOut = true;
      store.write(SIGNED_OUT);
      return res;
    }

    if (signedOut) return send(input, init, null);

    if (!token) {
      token = await autoLogin();
      isAuto = true;
    }
    const res = await send(input, init, token);
    if (res.status !== 401) return res;
    // Only the automatic session is renewed silently; an explicit user must sign in again
    if (!isAuto) return res;
    token = await autoLogin();
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

  setApiTransport(withBearerAuth(raw, login, localStorageSessionStore));

  // The demo transport authenticates with the bearer token and never keeps the refresh cookie, so
  // /api/auth/refresh always fails. Without a known expiry AuthProvider tries to refresh on startup,
  // fails and signs the user out. Report a far-away expiry; `withBearerAuth` renews the automatic
  // session on a 401.
  setAccessTokenExpiryFromSeconds(NEVER_EXPIRES_SECONDS);

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
