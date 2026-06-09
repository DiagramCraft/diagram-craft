import { HTTPError } from 'h3';
import { ORPCError } from '@orpc/server';

export const toORPCError = (error: unknown): never => {
  if (error instanceof ORPCError) throw error;

  if (HTTPError.isError(error)) {
    switch (error.status) {
      case 400:
        throw new ORPCError('BAD_REQUEST', { message: error.message });
      case 401:
        throw new ORPCError('UNAUTHORIZED', { message: error.message });
      case 403:
        throw new ORPCError('FORBIDDEN', { message: error.message });
      case 404:
        throw new ORPCError('NOT_FOUND', { message: error.message });
      case 409:
        throw new ORPCError('CONFLICT', { message: error.message });
      default:
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message: error.message });
    }
  }

  throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Internal Server Error' });
};
