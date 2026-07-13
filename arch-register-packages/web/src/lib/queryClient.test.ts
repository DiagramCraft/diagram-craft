import { MutationObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './http';
import { createQueryClient } from './queryClient';

describe('query client retries', () => {
  it('does not retry mutations by default', async () => {
    const client = createQueryClient();
    const mutationFn = vi.fn().mockRejectedValue(new Error('failed'));
    const observer = new MutationObserver(client, { mutationFn });

    await expect(observer.mutate(undefined)).rejects.toThrow('failed');

    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it('allows an explicitly idempotent mutation to opt into one retry', async () => {
    const client = createQueryClient();
    const mutationFn = vi.fn().mockRejectedValue(new Error('failed'));
    const observer = new MutationObserver(client, { mutationFn, retry: 1, retryDelay: 0 });

    await expect(observer.mutate(undefined)).rejects.toThrow('failed');

    expect(mutationFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry unauthorized queries and retains the existing policy otherwise', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    expect(retry).toBeTypeOf('function');
    if (typeof retry !== 'function') throw new Error('Expected a query retry predicate');

    expect(retry(0, new ApiError(401, 'Unauthorized'))).toBe(false);
    expect(retry(2, new ApiError(503, 'Unavailable'))).toBe(true);
    expect(retry(3, new ApiError(503, 'Unavailable'))).toBe(false);
  });
});
