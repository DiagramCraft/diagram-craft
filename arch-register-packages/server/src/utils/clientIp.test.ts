import { describe, expect, it } from 'vitest';
import { resolveClientIp } from './clientIp';

describe('resolveClientIp', () => {
  it('uses the socket address when no proxy is trusted', () => {
    expect(resolveClientIp('10.0.0.1', '1.2.3.4', 0)).toBe('10.0.0.1');
  });

  it('uses the last forwarded entry for one trusted hop', () => {
    expect(resolveClientIp('10.0.0.1', 'spoofed, 1.2.3.4', 1)).toBe('1.2.3.4');
  });

  it('skips additional trusted hops', () => {
    expect(resolveClientIp('10.0.0.1', '1.2.3.4, 10.1.1.1', 2)).toBe('1.2.3.4');
  });

  it('falls back to the socket address without a header', () => {
    expect(resolveClientIp('10.0.0.1', null, 1)).toBe('10.0.0.1');
  });

  it('returns null when nothing is known', () => {
    expect(resolveClientIp(undefined, null, 0)).toBeNull();
  });
});
