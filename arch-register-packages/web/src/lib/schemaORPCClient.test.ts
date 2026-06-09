import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { createWorkspaceSchemaORPC, listWorkspaceSchemasORPC } from './schemaORPCClient';

describe('schemaORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC list route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await listWorkspaceSchemasORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/schemas',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  it('uses the POC oRPC create route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'schema-1',
          workspace: 'default',
          name: 'Product',
          description: '',
          fields: [],
          color: null,
          icon: null,
          entity_count: 0,
          created_at: '2026-06-09T00:00:00.000Z',
          updated_at: '2026-06-09T00:00:00.000Z'
        }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )
    );

    await createWorkspaceSchemaORPC('default', { name: 'Product', fields: [] });

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/schemas',
      expect.objectContaining({
        method: 'POST',
        body: '{"name":"Product","fields":[]}'
      })
    );
  });
});
