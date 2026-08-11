import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contractSurfaceManifest } from '@arch-register/api-types/contractSurfaceManifest';

const fetchWithAuthResponse = vi.hoisted(() => vi.fn());

vi.mock('../auth/authClient', () => ({ fetchWithAuthResponse }));

import { orpcClient } from './orpcClient';

const requestPaths = () =>
  fetchWithAuthResponse.mock.calls.map(([input]) => new URL(input as string).pathname);

const findSubarray = (source: Uint8Array, target: Uint8Array) => {
  for (let start = 0; start <= source.length - target.length; start += 1) {
    if (target.every((byte, offset) => source[start + offset] === byte)) return start;
  }
  return -1;
};

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

    expect(requestPaths()).toEqual(['/api/dev/config', '/api/dev/users', '/api/dev/switch-user']);
  });

  it('keeps auth routes on the core API surface', async () => {
    await orpcClient.auth.config();

    expect(requestPaths()).toEqual(['/api/auth/config']);
  });

  it('uses the versioned application surface for workspace routes', async () => {
    fetchWithAuthResponse.mockResolvedValue(Response.json([]));

    await orpcClient.entities.list({ params: { workspace: 'default' }, query: {} });

    expect(requestPaths()).toEqual(['/api/application/v1/default/data']);
  });

  it('keeps Diagram Craft adapter routes on the core API surface', async () => {
    fetchWithAuthResponse.mockResolvedValue(Response.json([]));

    await orpcClient.diagramCraft.getSchemas({ params: { workspace: 'default' } });

    expect(requestPaths()).toEqual(['/api/adapters/diagram-craft/default/schemas']);
  });

  it('exports every router registered on the first-party manifest surfaces', () => {
    const { core, application, diagramCraft } = contractSurfaceManifest.surfaces;
    const expectedKeys = [
      ...Object.keys(core.contracts),
      ...Object.keys(application.contracts),
      ...Object.keys(diagramCraft.contracts)
    ].sort();

    expect(Object.keys(orpcClient).sort()).toEqual(expectedKeys);
  });

  it('preserves binary multipart bodies and forwards cancellation to the transport', async () => {
    fetchWithAuthResponse.mockResolvedValue(
      Response.json({
        valid: true,
        version: '1',
        source_workspace: { id: 'source', name: 'Source', url_slug: 'source' },
        available_data_types: [],
        summary: {},
        conflicts: [],
        errors: [],
        warnings: []
      })
    );
    const inputBytes = new Uint8Array([0, 1, 127, 128, 200, 255, 10, 13]);
    const controller = new AbortController();

    await orpcClient.workspaces.importParse(
      {
        params: { workspace: 'default' },
        body: {
          file: new Blob([inputBytes], { type: 'application/zip' })
        }
      },
      { signal: controller.signal }
    );

    const [input, init] = fetchWithAuthResponse.mock.calls[0] ?? [];
    expect(new URL(input as string).pathname).toBe('/api/application/v1/default/import/parse');
    expect(init?.signal).toBe(controller.signal);
    expect(init?.body).toBeInstanceOf(ArrayBuffer);

    const bodyBytes = new Uint8Array(init?.body as ArrayBuffer);
    expect(findSubarray(bodyBytes, inputBytes)).toBeGreaterThanOrEqual(0);
    expect(new Headers(init?.headers).get('content-type')).toMatch(
      /^multipart\/form-data; boundary=/
    );
  });
});
