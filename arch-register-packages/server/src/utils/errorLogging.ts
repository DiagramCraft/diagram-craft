import { isExpectedError } from './errorMetadata';

export type ErrorLogLevel = 'debug' | 'info' | 'warn' | 'error';

export const getHttpErrorLogLevel = (error: {
  status: number;
  data?: unknown;
  message?: string;
}): ErrorLogLevel => {
  if (error.status >= 500) return 'error';
  if (isExpectedError(error)) return 'debug';
  if (error.status === 404) return 'info';
  return 'warn';
};

export const getORPCErrorLogLevel = (error: {
  code: string;
  data?: unknown;
  message?: string;
}): ErrorLogLevel => {
  if (isExpectedError(error)) return 'debug';
  if (error.code === 'UNAUTHORIZED' || error.code === 'NOT_FOUND') return 'info';
  if (error.code === 'FORBIDDEN' || error.code === 'BAD_REQUEST' || error.code === 'CONFLICT') {
    return 'warn';
  }
  return 'error';
};
