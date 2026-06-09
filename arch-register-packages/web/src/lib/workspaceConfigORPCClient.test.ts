import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import {
  listLifecycleStatesORPC,
  listTeamsORPC,
  listTeamAssignmentsORPC
} from './workspaceConfigORPCClient';

describe('workspaceConfigORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC lifecycle-states route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listLifecycleStatesORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/config/lifecycle-states',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses the POC oRPC teams route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listTeamsORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/config/teams',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses the POC oRPC team-assignments route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listTeamAssignmentsORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/config/team-assignments',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
