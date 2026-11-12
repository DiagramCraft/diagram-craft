import { randomUUID } from 'node:crypto';
import { test, expect, createTestORPCClient } from '../helpers/fixtures';

type TestClient = ReturnType<typeof createTestORPCClient>;

const randomBadge = () =>
  Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
    ''
  );

const newWorkspace = async (orpc: TestClient) =>
  orpc.workspaces.create({
    body: { name: `Publish workspace ${randomUUID()}`, badge: randomBadge() }
  });

const stageEnum = async (
  orpc: TestClient,
  workspace: string,
  expectedRevision: number,
  itemId: string,
  name: string
) =>
  orpc.schemaDraft.stage({
    params: { workspace, kind: 'enum', itemId },
    body: { expectedRevision, op: 'create', payload: { name, options: [] } }
  });

test.describe('schema draft publish', () => {
  test('publishes staged items atomically and records a publication', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const categoryId = randomUUID();
    const enumId = randomUUID();

    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'category', itemId: categoryId },
      body: { expectedRevision: 0, op: 'create', payload: { name: 'Published category' } }
    });
    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'enum', itemId: enumId },
      body: {
        expectedRevision: 1,
        op: 'create',
        payload: { name: 'Published enum', category_id: categoryId, options: [] }
      }
    });

    const publication = await orpc.schemaDraft.publish({
      params,
      body: { expectedRevision: 2, summary: 'First release', migrationDecisions: [] }
    });
    expect(publication).toMatchObject({ number: 1, summary: 'First release' });
    expect(publication.items.map(i => i.kind).sort()).toEqual(['category', 'enum']);

    // Live definitions exist with the ids the draft used, and the draft is gone.
    const enums = await orpc.enums.list({ params });
    expect(enums.find(e => e.id === enumId)).toMatchObject({ name: 'Published enum' });
    expect(await orpc.schemaDraft.get({ params })).toMatchObject({ revision: 0, items: [] });

    const list = await orpc.schemaPublication.list({ params });
    expect(list.map(p => p.number)).toEqual([1]);
    expect(await orpc.schemaPublication.get({ params: { ...params, number: 1 } })).toMatchObject({
      summary: 'First release'
    });

    const versions = await orpc.schemaSnapshotVersion.list({
      params: { ...params, kind: 'enum', itemId: enumId }
    });
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, publicationId: publication.id });
  });

  test('rejects a stale draft revision and keeps the draft', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    await stageEnum(orpc, params.workspace, 0, randomUUID(), 'Stale');

    await expect(
      orpc.schemaDraft.publish({
        params,
        body: { expectedRevision: 0, summary: 'x', migrationDecisions: [] }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await orpc.schemaDraft.get({ params })).items).toHaveLength(1);
    expect(await orpc.schemaPublication.list({ params })).toEqual([]);
  });

  test('fails with 409 when a live item changed after it was staged', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const created = await orpc.enums.create({ params, body: { name: 'Live enum', options: [] } });

    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'enum', itemId: created.id },
      body: { expectedRevision: 0, op: 'update', payload: { name: 'Draft rename', options: [] } }
    });
    // Direct edits are allowed while the workspace is in direct mode.
    await orpc.enums.update({
      params: { ...params, id: created.id },
      body: { name: 'Changed live', options: [] }
    });

    await expect(
      orpc.schemaDraft.publish({
        params,
        body: { expectedRevision: 1, summary: 'x', migrationDecisions: [] }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const enums = await orpc.enums.list({ params });
    expect(enums.find(e => e.id === created.id)?.name).toBe('Changed live');
    expect((await orpc.schemaDraft.get({ params })).items).toHaveLength(1);
  });

  test('applies nothing when one item cannot be applied', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const first = randomUUID();
    await stageEnum(orpc, params.workspace, 0, first, 'Duplicate name');
    await stageEnum(orpc, params.workspace, 1, randomUUID(), 'Duplicate name');

    await expect(
      orpc.schemaDraft.publish({
        params,
        body: { expectedRevision: 2, summary: 'x', migrationDecisions: [] }
      })
    ).rejects.toBeTruthy();

    expect((await orpc.enums.list({ params })).find(e => e.id === first)).toBeUndefined();
    expect((await orpc.schemaDraft.get({ params })).items).toHaveLength(2);
    expect(await orpc.schemaPublication.list({ params })).toEqual([]);
  });

  test('rejects publishing when there is no draft', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    await expect(
      orpc.schemaDraft.publish({
        params: { workspace: workspace.url_slug },
        body: { expectedRevision: 0, summary: 'x', migrationDecisions: [] }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

test.describe('schema draft rollback', () => {
  test('stages a rollback draft from a previous published version', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const enumId = randomUUID();

    await stageEnum(orpc, params.workspace, 0, enumId, 'Original');
    await orpc.schemaDraft.publish({
      params,
      body: { expectedRevision: 1, summary: 'v1', migrationDecisions: [] }
    });
    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'enum', itemId: enumId },
      body: { expectedRevision: 0, op: 'update', payload: { name: 'Renamed', options: [] } }
    });
    await orpc.schemaDraft.publish({
      params,
      body: { expectedRevision: 1, summary: 'v2', migrationDecisions: [] }
    });

    const draft = await orpc.schemaDraft.fromVersion({
      params,
      body: { expectedRevision: 0, kind: 'enum', itemId: enumId, version: 1 }
    });
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ kind: 'enum', item_id: enumId, op: 'update' });
    expect(draft.items[0]?.payload).toMatchObject({ name: 'Original' });

    await orpc.schemaDraft.publish({
      params,
      body: { expectedRevision: draft.revision, summary: 'Roll back', migrationDecisions: [] }
    });
    expect((await orpc.enums.list({ params })).find(e => e.id === enumId)?.name).toBe('Original');
    const publications = await orpc.schemaPublication.list({ params });
    expect(publications.map(p => p.number)).toEqual([3, 2, 1]);
  });

  test('restores a deleted item as a create', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const enumId = randomUUID();
    await stageEnum(orpc, params.workspace, 0, enumId, 'Gone');
    await orpc.schemaDraft.publish({
      params,
      body: { expectedRevision: 1, summary: 'create', migrationDecisions: [] }
    });
    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'enum', itemId: enumId },
      body: { expectedRevision: 0, op: 'delete' }
    });
    await orpc.schemaDraft.publish({
      params,
      body: { expectedRevision: 1, summary: 'delete', migrationDecisions: [] }
    });

    const draft = await orpc.schemaDraft.fromVersion({
      params,
      body: { expectedRevision: 0, kind: 'enum', itemId: enumId, version: 1 }
    });
    expect(draft.items[0]).toMatchObject({ op: 'create', item_id: enumId });
  });
});
