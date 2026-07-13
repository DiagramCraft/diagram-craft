import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/http';
import { getRouteErrorMessage } from './RouteErrorComponent';

describe('route error messages', () => {
  it('uses permission-specific copy for 403 responses', () => {
    expect(getRouteErrorMessage(new ApiError(403, 'Missing permission'))).toMatchObject({
      title: 'You do not have access to this view',
      details: 'Missing permission'
    });
  });

  it('uses server-specific copy for 5xx responses', () => {
    expect(getRouteErrorMessage(new ApiError(503, 'Database unavailable'))).toMatchObject({
      title: 'The server could not complete this request',
      details: 'Database unavailable'
    });
  });

  it('uses connection-specific copy for network failures', () => {
    const error = new ApiError(undefined, 'Unable to reach the server.', { kind: 'network' });

    expect(getRouteErrorMessage(error)).toEqual({
      title: 'The server could not be reached',
      message: 'Check your connection and try again.',
      details: 'Unable to reach the server.'
    });
  });

  it('keeps the generic fallback for unrelated errors', () => {
    expect(getRouteErrorMessage(new Error('Render failed'))).toMatchObject({
      title: 'This view could not be loaded',
      details: 'Render failed'
    });
  });
});
