import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { assertSafeWebhookUrl, listWebhooks, normalizeWebhookUrl } from './webhookOperations';

const { requireFieldGroupAdminBypass } = vi.hoisted(() => ({
  requireFieldGroupAdminBypass: vi.fn()
}));

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  requireFieldGroupAdminBypass
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const originalNodeEnv = process.env['NODE_ENV'];
afterEach(() => {
  process.env['NODE_ENV'] = originalNodeEnv;
  requireFieldGroupAdminBypass.mockReset();
});

describe('webhook management authorization', () => {
  it('gates webhook management on the field-group admin bar, not workspace-admin role', async () => {
    const listWebhooksDb = vi.fn(async () => []);
    const db = { webhook: { listWebhooks: listWebhooksDb } } as unknown as DatabaseAdapter;
    requireFieldGroupAdminBypass.mockImplementation(() => {
      throw new Error('forbidden');
    });

    await expect(listWebhooks(db, 'ws-1', event)).rejects.toThrow('forbidden');
    expect(requireFieldGroupAdminBypass).toHaveBeenCalledWith(expect.anything());
    expect(listWebhooksDb).not.toHaveBeenCalled();
  });

  it('allows webhook management once the field-group admin bar is met', async () => {
    const listWebhooksDb = vi.fn(async () => []);
    const db = { webhook: { listWebhooks: listWebhooksDb } } as unknown as DatabaseAdapter;
    requireFieldGroupAdminBypass.mockImplementation(() => {});

    await expect(listWebhooks(db, 'ws-1', event)).resolves.toEqual([]);
    expect(listWebhooksDb).toHaveBeenCalledWith('ws-1');
  });
});

describe('normalizeWebhookUrl', () => {
  it('allows HTTPS and local HTTP outside production', () => {
    process.env['NODE_ENV'] = 'test';
    expect(normalizeWebhookUrl('https://Example.com/events?source=ar')).toBe(
      'https://example.com/events?source=ar'
    );
    expect(normalizeWebhookUrl('http://localhost:3020/webhook')).toBe(
      'http://localhost:3020/webhook'
    );
  });

  it('rejects insecure production and credential-bearing URLs', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => normalizeWebhookUrl('http://localhost:3020/webhook')).toThrow('HTTPS');
    expect(() => normalizeWebhookUrl('https://user:pass@example.com/hook')).toThrow('credentials');
  });

  it('rejects private HTTPS webhook hosts outside development', async () => {
    process.env['NODE_ENV'] = 'test';
    await expect(assertSafeWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow(
      'publicly routable'
    );
    await expect(assertSafeWebhookUrl('https://[::1]/hook')).rejects.toThrow('publicly routable');
  });

  it('skips private-host safety checks in development', async () => {
    process.env['NODE_ENV'] = 'development';
    await expect(assertSafeWebhookUrl('https://127.0.0.1/hook')).resolves.toBeUndefined();
    await expect(assertSafeWebhookUrl('https://[::1]/hook')).resolves.toBeUndefined();
  });

  it('continues enforcing URL shape rules in development', () => {
    process.env['NODE_ENV'] = 'development';
    expect(() => normalizeWebhookUrl('ftp://127.0.0.1/hook')).toThrow('HTTPS');
    expect(() => normalizeWebhookUrl('https://user:pass@127.0.0.1/hook')).toThrow('credentials');
  });
});
