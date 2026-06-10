import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { listAuditLogORPC, getAuditStatsORPC } from './auditORPCClient';

describe('auditORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC audit list route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listAuditLogORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      expect.stringContaining('/api/default/audit'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses the POC oRPC audit stats route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total: 0,
          byOperation: [],
          byEntityType: [],
          recentActivity: []
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    );

    await getAuditStatsORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/default/audit/stats',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
