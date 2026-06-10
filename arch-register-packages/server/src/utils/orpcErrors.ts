import { HTTPError } from 'h3';
import { ORPCError, ValidationError, onError } from '@orpc/server';
import { z } from 'zod';
import { createLogger } from './logger';

const orpcLogger = createLogger('orpc');

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
        orpcLogger.error(`Unexpected HTTP error (${error.status}): ${error.message}`, error);
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message: error.message });
    }
  }

  orpcLogger.error(
    'Unexpected error in ORPC handler',
    error instanceof Error ? error : new Error(String(error))
  );
  throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Internal Server Error' });
};

// Shared clientInterceptors for all OpenAPIHandler instances.
// Catches framework-level errors (e.g. output validation failures) that bypass
// the per-handler try-catch and would otherwise go unlogged.
export const orpcErrorInterceptors = [
  onError((error: unknown) => {
    if (
      error instanceof ORPCError &&
      error.code === 'INTERNAL_SERVER_ERROR' &&
      error.cause instanceof ValidationError
    ) {
      const zodError = new z.ZodError(error.cause.issues as z.core.$ZodIssue[]);
      orpcLogger.error(`Output validation failed:\n${z.prettifyError(zodError)}`);
    } else {
      orpcLogger.error(
        'ORPC framework error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  })
];
