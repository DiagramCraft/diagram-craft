import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoTokenService, demoPasswordHasher } from './demoAuthServices';
import { getAuthServices } from './authServices';

const claims = { sub: 'u1', name: 'User', provider: 'local' as const, type: 'access' as const };

describe('demoPasswordHasher', () => {
  it('verifies the matching password only', async () => {
    const hash = await demoPasswordHasher.hash('secret');
    expect(await demoPasswordHasher.verify(hash, 'secret')).toBe(true);
    expect(await demoPasswordHasher.verify(hash, 'other')).toBe(false);
  });

  it('never matches the dummy hash', async () => {
    expect(await demoPasswordHasher.verify(demoPasswordHasher.dummyHash, 'anything')).toBe(false);
  });
});

describe('createDemoTokenService', () => {
  afterEach(() => vi.useRealTimers());

  it('round-trips claims and adds iat/exp/jti', () => {
    const service = createDemoTokenService();
    const payload = service.verify(service.sign(claims));
    expect(payload).toMatchObject(claims);
    expect(payload.exp - payload.iat).toBe(3600);
    expect(payload.jti).toBeTruthy();
  });

  it('rejects expired tokens', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const service = createDemoTokenService({ access: 10, refresh: 20 });
    const token = service.sign(claims);
    vi.setSystemTime(Date.now() + 11_000);
    expect(() => service.verify(token)).toThrow('Invalid or expired token');
  });

  it('rejects malformed tokens', () => {
    expect(() => createDemoTokenService().verify('not-a-token')).toThrow(
      'Invalid or expired token'
    );
  });

  it('reports the configured expiry', () => {
    expect(createDemoTokenService({ access: 5, refresh: 9 }).expirySeconds('refresh')).toBe(9);
  });
});

describe('getAuthServices', () => {
  it('is configured by the test setup', () => {
    expect(getAuthServices().passwordHasher).toBeDefined();
  });
});
