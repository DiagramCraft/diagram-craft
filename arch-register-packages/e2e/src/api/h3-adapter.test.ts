import { createApiTest, expect } from '../helpers/fixtures';

const test = createApiTest();

test.describe('H3 Node adapter', () => {
  test('serves routes, CORS preflight, and handler errors over HTTP', async ({ server, auth }) => {
    const configResponse = await fetch(`${server.baseUrl}/api/auth/config`);
    expect(configResponse.status).toBe(200);
    expect(await configResponse.json()).toEqual({ mode: 'local' });

    const corsResponse = await fetch(`${server.baseUrl}/api/auth/config`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET'
      }
    });
    expect(corsResponse.status).toBe(204);
    expect(corsResponse.headers.get('access-control-allow-origin')).toBe('*');

    const protectedResponse = await fetch(`${server.baseUrl}/api/application/v1/default/schemas`, {
      headers: { Authorization: auth }
    });
    expect(protectedResponse.status).toBe(200);

    const errorResponse = await fetch(`${server.baseUrl}/api/auth/oidc/authorize`);
    expect(errorResponse.status).toBe(400);
  });

  test('matches a percent-encoded route segment through the Node adapter', async ({
    server,
    auth
  }) => {
    const response = await fetch(`${server.baseUrl}/api/application/v1/%64efault/schemas`, {
      headers: { Authorization: auth }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.any(Array));
  });
});
