import { randomUUID } from 'node:crypto';
import { test, expect, createTestORPCClient } from '../helpers/fixtures';
import { createIsolatedWorkspace, randomBadge } from '../helpers/isolatedWorkspace';

type TestClient = ReturnType<typeof createTestORPCClient>;

const newWorkspace = (orpc: TestClient) => createIsolatedWorkspace(orpc, 'Draft workspace');

test.describe('schema draft', () => {
  test('returns an empty draft at revision 0', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const draft = await orpc.schemaDraft.get({ params: { workspace: workspace.url_slug } });
    expect(draft).toMatchObject({ revision: 0, items: [] });
  });

  test('stages, restages and unstages items without touching live definitions', async ({
    orpc
  }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const enumsBefore = await orpc.enums.list({ params });

    const itemId = randomUUID();
    const staged = await orpc.schemaDraft.stage({
      params: { ...params, kind: 'enum', itemId },
      body: { expectedRevision: 0, op: 'create', payload: { name: 'Staged', options: [] } }
    });
    expect(staged.revision).toBe(1);
    expect(staged.items).toHaveLength(1);

    const restaged = await orpc.schemaDraft.stage({
      params: { ...params, kind: 'enum', itemId },
      body: { expectedRevision: 1, op: 'create', payload: { name: 'Staged again', options: [] } }
    });
    expect(restaged.revision).toBe(2);
    expect(restaged.items).toHaveLength(1);
    expect(restaged.items[0]?.payload).toMatchObject({ name: 'Staged again' });

    expect(await orpc.enums.list({ params })).toEqual(enumsBefore);

    const unstaged = await orpc.schemaDraft.unstage({
      params: { ...params, kind: 'enum', itemId },
      query: { expectedRevision: 2 }
    });
    expect(unstaged).toMatchObject({ revision: 3, items: [] });
  });

  test('rejects a stale expectedRevision on stage, unstage and discard', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const itemId = randomUUID();
    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'category', itemId },
      body: { expectedRevision: 0, op: 'create', payload: { name: 'Cat' } }
    });

    await expect(
      orpc.schemaDraft.stage({
        params: { ...params, kind: 'category', itemId: randomUUID() },
        body: { expectedRevision: 0, op: 'create', payload: { name: 'Other' } }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      orpc.schemaDraft.unstage({
        params: { ...params, kind: 'category', itemId },
        query: { expectedRevision: 5 }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      orpc.schemaDraft.discard({ params, query: { expectedRevision: 5 } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(await orpc.schemaDraft.discard({ params, query: { expectedRevision: 1 } })).toEqual({
      success: true
    });
    expect(await orpc.schemaDraft.get({ params })).toMatchObject({ revision: 0, items: [] });
  });

  test('rejects an invalid payload and updates of unknown items', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    await expect(
      orpc.schemaDraft.stage({
        params: { ...params, kind: 'enum', itemId: randomUUID() },
        body: { expectedRevision: 0, op: 'create', payload: { nope: true } }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      orpc.schemaDraft.stage({
        params: { ...params, kind: 'enum', itemId: randomUUID() },
        body: { expectedRevision: 0, op: 'delete' }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('records the live version as base version for updates and deletes', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const category = await orpc.categories.create({ params, body: { name: 'Live' } });
    const staged = await orpc.schemaDraft.stage({
      params: { ...params, kind: 'category', itemId: category.id },
      body: { expectedRevision: 0, op: 'delete' }
    });
    expect(staged.items[0]).toMatchObject({ op: 'delete', payload: null });
    expect(staged.items[0]?.base_version).toEqual(expect.any(String));
    // The live category is untouched
    expect((await orpc.categories.list({ params })).map(c => c.id)).toContain(category.id);
  });

  test('draft mode blocks direct schema changes; direct mode is unchanged', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };

    expect(await orpc.schemaDraft.getMode({ params })).toEqual({ schemaChangeMode: 'direct' });
    const category = await orpc.categories.create({ params, body: { name: 'Direct' } });

    await orpc.schemaDraft.setMode({ params, body: { schemaChangeMode: 'draft' } });
    expect(await orpc.schemaDraft.getMode({ params })).toEqual({ schemaChangeMode: 'draft' });

    await expect(
      orpc.categories.create({ params, body: { name: 'Blocked' } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      orpc.categories.update({ params: { ...params, id: category.id }, body: { name: 'Nope' } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      orpc.categories.remove({ params: { ...params, id: category.id } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      orpc.enums.create({ params, body: { name: 'Blocked enum' } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      orpc.schemas.create({ params, body: { name: 'Blocked schema' } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    // Staging still works in draft mode
    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'category', itemId: randomUUID() },
      body: { expectedRevision: 0, op: 'create', payload: { name: 'Staged' } }
    });

    await orpc.schemaDraft.setMode({ params, body: { schemaChangeMode: 'direct' } });
    const updated = await orpc.categories.update({
      params: { ...params, id: category.id },
      body: { name: 'Direct renamed' }
    });
    expect(updated.name).toBe('Direct renamed');
  });

  test('definition import is blocked while a draft is open', async ({ orpc }) => {
    const suffix = randomUUID();
    const source = await orpc.workspaces.create({
      body: { name: `Import source ${suffix}`, badge: randomBadge() }
    });
    const target = await newWorkspace(orpc);
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: { name: `Imported ${suffix}` }
    });
    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'workspace', id: source.url_slug },
        selection: {
          schemas: [schema.id],
          enums: [],
          documentTypes: [],
          relationSchemas: [],
          fieldGroups: [],
          dashboard: false
        }
      }
    });
    await orpc.schemaDraft.stage({
      params: { workspace: target.url_slug, kind: 'category', itemId: randomUUID() },
      body: { expectedRevision: 0, op: 'create', payload: { name: 'Pending' } }
    });
    await expect(
      orpc.workspaces.definitionImportExecute({
        params: { workspace: target.url_slug },
        body: {
          source: preview.source,
          selection: preview.selection,
          schemas: preview.schemas,
          enums: preview.enums,
          documentTypes: preview.documentTypes,
          relationSchemas: preview.relationSchemas,
          fieldGroups: preview.fieldGroups,
          dashboardWidgets: preview.dashboardWidgets,
          keyPrefixRemaps: preview.keyPrefixRemaps,
          fingerprint: preview.fingerprint,
          confirmed: true
        }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('returns 401 without authentication', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.schemaDraft.get({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  test('reviews a draft without changing live definitions', async ({ orpc }) => {
    const workspace = await newWorkspace(orpc);
    const params = { workspace: workspace.url_slug };
    const itemId = randomUUID();
    await orpc.schemaDraft.stage({
      params: { ...params, kind: 'enum', itemId },
      body: { expectedRevision: 0, op: 'create', payload: { name: 'Reviewed', options: [] } }
    });
    const enumsBefore = await orpc.enums.list({ params });

    const review = await orpc.schemaDraft.review({ params });
    expect(review.revision).toBe(1);
    expect(review.items).toMatchObject([{ kind: 'enum', itemId, op: 'create', name: 'Reviewed' }]);
    expect(review.summary).toMatchObject({ blocking: 0, unresolvedMigrations: 0 });
    expect(review.recordValidation.jobRunId).toBeTruthy();

    expect(await orpc.enums.list({ params })).toEqual(enumsBefore);
    expect((await orpc.schemaDraft.get({ params })).revision).toBe(1);
  });
});
