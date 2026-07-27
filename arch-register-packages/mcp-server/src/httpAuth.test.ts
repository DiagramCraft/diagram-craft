import { describe, expect, it } from 'vitest';
import { requestToken } from './httpAuth';

describe('hosted MCP authentication', () => {
  it('accepts workspace API tokens from Bearer authorization', () => {
    expect(requestToken({ headers: { authorization: 'Bearer ar_pat_workspace' } } as never)).toBe(
      'ar_pat_workspace'
    );
  });

  it.each([
    undefined,
    'Basic ar_pat_workspace',
    'Bearer user-token',
    'Bearer'
  ])('rejects invalid authorization %s', authorization => {
    expect(requestToken({ headers: { authorization } } as never)).toBeNull();
  });
});
