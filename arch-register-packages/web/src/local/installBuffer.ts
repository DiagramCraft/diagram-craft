// The trailing slash selects the `buffer` npm package, not a Node/bundler built-in of the same name
import { Buffer as BufferPolyfill } from 'buffer/';

/**
 * Installs `Buffer` on the global object for the demo Worker. The `buffer` package (v6) predates
 * Node's `base64url` encoding, which the server uses for API tokens, webhook secrets and seed
 * data, so it is added here.
 */

type Buf = typeof BufferPolyfill;

const toBase64Url = (base64: string) =>
  base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value: string) => value.replace(/-/g, '+').replace(/_/g, '/');

let patched = false;

const patchBase64Url = (B: Buf) => {
  if (patched) return;
  patched = true;

  const originalToString = B.prototype.toString;
  B.prototype.toString = function (
    this: InstanceType<Buf>,
    encoding?: string,
    start?: number,
    end?: number
  ) {
    if (encoding === 'base64url') {
      return toBase64Url(originalToString.call(this, 'base64', start, end));
    }
    return originalToString.call(this, encoding, start, end);
  };

  const originalFrom = B.from.bind(B) as (...args: unknown[]) => InstanceType<Buf>;
  B.from = ((value: unknown, ...args: unknown[]) =>
    typeof value === 'string' && args[0] === 'base64url'
      ? originalFrom(fromBase64Url(value), 'base64')
      : originalFrom(value, ...args)) as Buf['from'];

  const originalIsEncoding = B.isEncoding.bind(B);
  B.isEncoding = ((encoding: string) =>
    encoding?.toLowerCase() === 'base64url' || originalIsEncoding(encoding)) as Buf['isEncoding'];
};

export const installBuffer = () => {
  patchBase64Url(BufferPolyfill);
  (globalThis as Record<string, unknown>)['Buffer'] ??= BufferPolyfill;
  return BufferPolyfill;
};
