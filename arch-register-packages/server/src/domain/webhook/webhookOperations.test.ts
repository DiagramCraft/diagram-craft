import { afterEach, describe, expect, it } from 'vitest';
import { normalizeWebhookUrl } from './webhookOperations';

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
});
