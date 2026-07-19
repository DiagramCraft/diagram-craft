import { HTTPError } from 'h3';
import { ORPCError, ValidationError, onError, os } from '@orpc/server';
import { z } from 'zod';
import { createLogger } from './logger';
import { OpenAPIHandlerOptions } from '@orpc/openapi/fetch';
import { getORPCErrorLogLevel } from './errorLogging';

const orpcLogger = createLogger('orpc');

export const toORPCError = (error: unknown): never => {
  if (error instanceof ORPCError) throw error;

  if (HTTPError.isError(error)) {
    switch (error.status) {
      case 400:
        throw new ORPCError('BAD_REQUEST', { message: error.message, data: error.data });
      case 401:
        throw new ORPCError('UNAUTHORIZED', { message: error.message, data: error.data });
      case 403:
        throw new ORPCError('FORBIDDEN', { message: error.message, data: error.data });
      case 404:
        throw new ORPCError('NOT_FOUND', { message: error.message, data: error.data });
      case 409:
        throw new ORPCError('CONFLICT', { message: error.message, data: error.data });
      case 413:
        throw new ORPCError('PAYLOAD_TOO_LARGE', { message: error.message, data: error.data });
      case 415:
        throw new ORPCError('UNSUPPORTED_MEDIA_TYPE', {
          message: error.message,
          data: error.data
        });
      case 429:
        throw new ORPCError('TOO_MANY_REQUESTS', { message: error.message, data: error.data });
      case 503:
        throw new ORPCError('SERVICE_UNAVAILABLE', { message: error.message, data: error.data });
      case 504:
        throw new ORPCError('GATEWAY_TIMEOUT', { message: error.message, data: error.data });
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

/**
 * Converts errors from domain operations at the router boundary. Applying this
 * middleware to a contract implementer keeps individual handlers focused on
 * mapping transport input to domain operations.
 */
export const orpcErrorMiddleware = os.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    return toORPCError(error);
  }
});

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
      const message = `ORPC client error [${error.code}]: ${error.message}`;
      switch (getORPCErrorLogLevel(error)) {
        case 'debug':
          orpcLogger.debug(message);
          break;
        case 'info':
          orpcLogger.info(message);
          break;
        case 'warn':
          orpcLogger.warn(message);
          break;
        case 'error':
          orpcLogger.error(
            'ORPC framework error',
            error instanceof Error ? error : new Error(String(error))
          );
          break;
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
