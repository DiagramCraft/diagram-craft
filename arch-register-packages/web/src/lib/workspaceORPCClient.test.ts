import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { listWorkspacesORPC } from './workspaceORPCClient';

describe('workspaceORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC list workspaces route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listWorkspacesORPC();

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/workspaces',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
