import type { JWTPayload } from '../types';
import type { PasswordHasher, TokenService, TokenType } from './authServices';

/**
 * Demo-only implementations for the browser-local demo. They provide NO security:
 * passwords are stored in the clear (prefixed) and tokens are unsigned.
 */

const PREFIX = 'demo:';

export const demoPasswordHasher: PasswordHasher = {
  dummyHash: `${PREFIX}\u0000`,
  hash: async password => `${PREFIX}${password}`,
  verify: async (hash, password) => hash === `${PREFIX}${password}`
};

const encode = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const decode = (value: string): unknown => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

export const createDemoTokenService = (
  expiry: Record<TokenType, number> = { access: 3600, refresh: 7 * 86400 }
): TokenService => ({
  expirySeconds: type => expiry[type],

  sign: claims => {
    const iat = Math.floor(Date.now() / 1000);
    return encode({
      ...claims,
      jti: claims.jti ?? crypto.randomUUID(),
      iat,
      exp: iat + expiry[claims.type]
    });
  },

  verify: token => {
    let payload: JWTPayload;
    try {
      payload = decode(token) as JWTPayload;
    } catch {
      throw new Error('Invalid or expired token');
    }
    if (typeof payload?.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('Invalid or expired token');
    }
    return payload;
  }
});
