import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listEntityProjects } = vi.hoisted(() => ({ listEntityProjects: vi.fn() }));

vi.mock('./orpcClient', () => ({
  orpcClient: { projects: { listEntityProjects } }
}));

import { fetchEntityProjects } from './projectOperations';

describe('fetchEntityProjects', () => {
  beforeEach(() => listEntityProjects.mockReset());

  it('loads project associations with exactly one purpose-specific request', async () => {
    listEntityProjects.mockResolvedValue([]);

    await fetchEntityProjects('ws-1', 'entity-1');

    expect(listEntityProjects).toHaveBeenCalledOnce();
    expect(listEntityProjects).toHaveBeenCalledWith({
      params: { workspace: 'ws-1', entityId: 'entity-1' }
    });
  });
});
