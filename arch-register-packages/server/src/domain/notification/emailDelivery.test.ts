import { describe, expect, it } from 'vitest';
import { overrideRecipientDomain } from './emailDelivery';

describe('email delivery helpers', () => {
  it('rewrites only the recipient domain while preserving the local part', () => {
    expect(overrideRecipientDomain('alice+test@example.com', 'mail.test')).toBe(
      'alice+test@mail.test'
    );
  });

  it('leaves recipients unchanged when no override is configured', () => {
    expect(overrideRecipientDomain('alice@example.com', null)).toBe('alice@example.com');
  });

  it('rejects malformed recipient domains', () => {
    expect(() => overrideRecipientDomain('alice@example.com', '.invalid')).toThrow();
  });
});
