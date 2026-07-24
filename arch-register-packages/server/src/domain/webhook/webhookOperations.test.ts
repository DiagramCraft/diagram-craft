import { afterEach, describe, expect, it } from 'vitest';
import { assertSafeWebhookUrl, normalizeWebhookUrl } from './webhookOperations';

const originalNodeEnv = process.env['NODE_ENV'];
afterEach(() => {
  process.env['NODE_ENV'] = originalNodeEnv;
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
