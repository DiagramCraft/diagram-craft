import { HTTPError } from 'h3';
import { ORPCError } from '@orpc/server';
import { describe, expect, it, vi } from 'vitest';
import { toORPCError } from './orpcErrors';

describe('toORPCError', () => {
  it('preserves existing ORPC errors', () => {
    const error = new ORPCError('CONFLICT', { message: 'Already exists' });

    expect(() => toORPCError(error)).toThrow(error);
  });

  it('maps HTTP errors to the corresponding ORPC error', () => {
    const error = new HTTPError({ status: 404, message: 'Missing' });

    try {
      toORPCError(error);
    } catch (mapped) {
      expect(mapped).toBeInstanceOf(ORPCError);
      expect(mapped).toMatchObject({ code: 'NOT_FOUND', message: 'Missing' });
    }
  });

  it('hides unexpected error details', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      toORPCError(new Error('database password'));
    } catch (mapped) {
      expect(mapped).toBeInstanceOf(ORPCError);
      expect(mapped).toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error'
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
