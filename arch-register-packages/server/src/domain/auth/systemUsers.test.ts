import { describe, expect, it } from 'vitest';
import { getSystemUserId, isSystemUserId } from './systemUsers';

describe('systemUsers', () => {
  it('looks up a system user id by key', () => {
    expect(getSystemUserId('workspace-token-owner')).toBe(
      '00000000-0000-0000-0000-0000000000a3'
    );
  });

  it('shares the same underlying row for keys that reuse a seeded user', () => {
    expect(getSystemUserId('ai-metadata-generator')).toBe(getSystemUserId('technology-eol-job'));
  });

  it('recognizes registered system user ids', () => {
    expect(isSystemUserId(getSystemUserId('ai-metadata-generator'))).toBe(true);
    expect(isSystemUserId(getSystemUserId('workspace-token-owner'))).toBe(true);
  });

  it('rejects ids that are not registered system users', () => {
    expect(isSystemUserId('00000000-0000-0000-0000-000000000000')).toBe(false);
  });
});
