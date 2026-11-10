import { randomUUID } from 'node:crypto';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();
const params = { workspace: 'default' };

test.describe('schema draft permissions', () => {
  test('viewer can read the draft but cannot stage, unstage, discard or change mode', async ({
    personas
  }) => {
    const { orpc } = personas.workspaceViewer;
    expect(await orpc.schemaDraft.get({ params })).toMatchObject({ items: expect.any(Array) });
    await expect(
      orpc.schemaDraft.stage({
        params: { ...params, kind: 'category', itemId: randomUUID() },
        body: { expectedRevision: 0, op: 'create', payload: { name: 'Blocked' } }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      orpc.schemaDraft.unstage({
        params: { ...params, kind: 'category', itemId: randomUUID() },
        query: { expectedRevision: 0 }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      orpc.schemaDraft.discard({ params, query: { expectedRevision: 0 } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      orpc.schemaDraft.setMode({ params, body: { schemaChangeMode: 'draft' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
