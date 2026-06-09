import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { createWorkspaceEnumORPC, listWorkspaceEnumsORPC } from './enumORPCClient';

describe('enumORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC list route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await listWorkspaceEnumsORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/enums',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  it('uses the POC oRPC create route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'enum-1',
          workspace: 'default',
          name: 'Status',
          options: [],
          sort_order: 0,
          created_at: '2026-06-09T00:00:00.000Z',
          updated_at: '2026-06-09T00:00:00.000Z'
        }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )
    );

    await createWorkspaceEnumORPC('default', { name: 'Status', options: [] });

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/enums',
      expect.objectContaining({
        method: 'POST',
        body: '{"name":"Status","options":[]}'
      })
    );
  });
});
