import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookup } from 'node:dns/promises';
import {
  assertPublicOutboundHost,
  isPrivateIpAddress,
  resolvePublicOutboundHost,
  UnsafeOutboundHostError
} from './outboundUrlSafety';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

const lookupMock = vi.mocked(lookup);

describe('outbound URL safety', () => {
  beforeEach(() => lookupMock.mockReset());

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1'
  ])('classifies %s as private', address => {
    expect(isPrivateIpAddress(address)).toBe(true);
  });

  it('rejects local hostnames before DNS lookup', async () => {
    await expect(
      assertPublicOutboundHost('service.localhost', 'host must be public')
    ).rejects.toBeInstanceOf(UnsafeOutboundHostError);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a hostname when any resolved address is private', async () => {
    lookupMock.mockResolvedValue([
      { address: '203.0.113.10', family: 4 },
      { address: '10.0.0.10', family: 4 }
    ] as never);

    await expect(assertPublicOutboundHost('example.test', 'host must be public')).rejects.toThrow(
      'host must be public'
    );
  });

  it('returns all public addresses for DNS pinning', async () => {
    lookupMock.mockResolvedValue([
      { address: '203.0.113.10', family: 4 },
      { address: '2001:db8::10', family: 6 }
    ] as never);

    await expect(resolvePublicOutboundHost('example.test', 'host must be public')).resolves.toEqual(
      [
        { address: '203.0.113.10', family: 4 },
        { address: '2001:db8::10', family: 6 }
      ]
    );
  });
});
