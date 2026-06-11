import { HTTPError } from 'h3';
import { ORPCError, ValidationError, onError } from '@orpc/server';
import { z } from 'zod';
import { createLogger } from './logger';
import { OpenAPIHandlerOptions } from '@orpc/openapi/fetch';

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
      case 413:
        throw new ORPCError('PAYLOAD_TOO_LARGE', { message: error.message });
      case 415:
        throw new ORPCError('UNSUPPORTED_MEDIA_TYPE', { message: error.message });
      case 429:
        throw new ORPCError('TOO_MANY_REQUESTS', { message: error.message });
      case 503:
        throw new ORPCError('SERVICE_UNAVAILABLE', { message: error.message });
      case 504:
        throw new ORPCError('GATEWAY_TIMEOUT', { message: error.message });
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
  onError(async (error: unknown) => {
    if (error instanceof ORPCError && error.cause instanceof ValidationError) {
      const zodError = new z.ZodError(error.cause.issues as z.core.$ZodIssue[]);
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        orpcLogger.error(`Output validation failed:\n${z.prettifyError(zodError)}`);
      } else if (error.code === 'BAD_REQUEST') {
        orpcLogger.error(`Input validation failed:\n${z.prettifyError(zodError)}`);
      }
    } else if (error instanceof ORPCError) {
      // Expected auth failures during initial page load - log as debug to reduce noise
      if (error.code === 'UNAUTHORIZED' && error.message === 'Refresh token is required') {
        orpcLogger.debug('Refresh token is required (expected for unauthenticated requests)');
      } else if (error.code === 'UNAUTHORIZED' || error.code === 'NOT_FOUND') {
        // Expected auth errors - log at info without stack trace
        orpcLogger.info(`ORPC client error [${error.code}]: ${error.message}`);
      } else if (error.code === 'FORBIDDEN' || error.code === 'BAD_REQUEST' || error.code === 'CONFLICT') {
        // Client errors that may indicate misuse - log at warn without stack trace
        orpcLogger.warn(`ORPC client error [${error.code}]: ${error.message}`);
      } else {
        orpcLogger.error(
          'ORPC framework error',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    } else {
      orpcLogger.error(
        'ORPC framework error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  })
  // biome-ignore lint/suspicious/noExplicitAny: Needed
] as NoInfer<OpenAPIHandlerOptions<Record<PropertyKey, any>>>['clientInterceptors'];
