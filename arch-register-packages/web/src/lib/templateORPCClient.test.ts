import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { listProjectTemplatesORPC } from './templateORPCClient';

describe('templateORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC list-for-project route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ workspaceTemplates: [], projectTemplates: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    );

    await listProjectTemplatesORPC('default', 'project-1');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/projects/project-1/templates',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
