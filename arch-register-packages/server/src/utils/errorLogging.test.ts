import { describe, expect, it } from 'vitest';
import { getHttpErrorLogLevel, getORPCErrorLogLevel } from './errorLogging';

describe('getHttpErrorLogLevel', () => {
  it('uses expected metadata for debug routing regardless of the message', () => {
    expect(
      getHttpErrorLogLevel({
        status: 401,
        data: { expected: true },
        message: 'A different authorization message'
      })
    ).toBe('debug');
  });

  it('retains the default HTTP severity mapping', () => {
    expect(getHttpErrorLogLevel({ status: 404 })).toBe('info');
    expect(getHttpErrorLogLevel({ status: 400 })).toBe('warn');
    expect(getHttpErrorLogLevel({ status: 500 })).toBe('error');
  });
});

describe('getORPCErrorLogLevel', () => {
  it('uses expected metadata for debug routing regardless of the message', () => {
    expect(
      getORPCErrorLogLevel({
        code: 'UNAUTHORIZED',
        data: { expected: true },
        message: 'A different refresh-token message'
      })
    ).toBe('debug');
  });

  it('retains the default oRPC severity mapping', () => {
    expect(getORPCErrorLogLevel({ code: 'UNAUTHORIZED' })).toBe('info');
    expect(getORPCErrorLogLevel({ code: 'NOT_FOUND' })).toBe('info');
    expect(getORPCErrorLogLevel({ code: 'BAD_REQUEST' })).toBe('warn');
    expect(getORPCErrorLogLevel({ code: 'INTERNAL_SERVER_ERROR' })).toBe('error');
  });
});
