import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuthResponse = vi.hoisted(() => vi.fn());

vi.mock('../auth/authClient', () => ({ fetchWithAuthResponse }));

import { orpcClient } from './orpcClient';

describe('oRPC API surface routing', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
    fetchWithAuthResponse.mockResolvedValue(Response.json({ enabled: false }));
  });

  it('keeps dev routes on the core API surface', async () => {
    fetchWithAuthResponse
      .mockResolvedValueOnce(Response.json({ enabled: false }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    await orpcClient.dev.config();
    await orpcClient.dev.listUsers();
    await orpcClient.dev.switchUser({ body: { userId: 'user-1' } });

    expect(fetchWithAuthResponse.mock.calls.map(([path]) => path)).toEqual([
      '/api/dev/config',
      '/api/dev/users',
      '/api/dev/switch-user'
    ]);
  });

  it('keeps auth routes on the core API surface', async () => {
    await orpcClient.auth.config();

    expect(fetchWithAuthResponse).toHaveBeenCalledWith('/api/auth/config', expect.anything());
  });

  it('uses the versioned application surface for workspace routes', async () => {
    fetchWithAuthResponse.mockResolvedValue(Response.json([]));

    await orpcClient.entities.list({ params: { workspace: 'default' }, query: {} });

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/application/v1/default/data',
      expect.anything()
    );
  });

  it('keeps Diagram Craft adapter routes on the core API surface', async () => {
    fetchWithAuthResponse.mockResolvedValue(Response.json([]));

    await orpcClient.diagramCraft.getSchemas({ params: { workspace: 'default' } });

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/adapters/diagram-craft/default/schemas',
      expect.anything()
    );
  });
});
