import { sha1 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// Subset of node:crypto used by the server code paths reachable in the demo Worker.
// `createCipheriv`/`createDecipheriv`/`scryptSync` are only used for stored AI API keys,
// which the demo never sets.

export const randomUUID = (): string => globalThis.crypto.randomUUID();

export const randomBytes = (size: number): Buffer =>
  Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size)));

const toBytes = (data: string | Uint8Array): Uint8Array =>
  typeof data === 'string' ? new TextEncoder().encode(data) : data;

const digest = (bytes: Uint8Array, encoding?: string) =>
  encoding === 'hex' ? bytesToHex(bytes) : Buffer.from(bytes);

type HashLike = {
  update: (data: string | Uint8Array) => HashLike;
  digest: (encoding?: 'hex') => string | Buffer;
};

const collect = (finish: (all: Uint8Array) => Uint8Array): HashLike => {
  const chunks: Uint8Array[] = [];
  const self: HashLike = {
    update: data => {
      chunks.push(toBytes(data));
      return self;
    },
    digest: encoding => digest(finish(Buffer.concat(chunks)), encoding)
  };
  return self;
};

// sha1 is used for deterministic ids (schema key prefixes, workspace remapping), not for security
const hashes = { sha1, sha256 } as const;

const hashFor = (algorithm: string) => {
  const hash = hashes[algorithm as keyof typeof hashes];
  if (!hash) throw new Error(`Hash ${algorithm} is not supported in the demo`);
  return hash;
};

export const createHash = (algorithm: string): HashLike => {
  const hash = hashFor(algorithm);
  return collect(all => hash(all));
};

export const createHmac = (algorithm: string, key: string | Uint8Array): HashLike => {
  const hash = hashFor(algorithm);
  return collect(all => hmac(hash, toBytes(key), all));
};

const unsupported = (name: string) => () => {
  throw new Error(`${name} is not available in the browser demo`);
};
export const createCipheriv = unsupported('createCipheriv');
export const createDecipheriv = unsupported('createDecipheriv');
export const scryptSync = unsupported('scryptSync');
