import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureSchema, createFixtureWorkspace } from '../testSupport/fixtures';
import { createFixtureEntity } from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('CatalogDatabase entity versions', getDb => {
  const setup = async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);
    const entity = await createFixtureEntity(db, workspace, schema);
    return { db, workspace, entity };
  };

  const version = (
    entityId: string,
    overrides: Partial<{ version_number: number; kind: 'autosave' | 'saved_version' }> = {}
  ) => ({
    id: randomUUID(),
    workspace: '',
    record_id: entityId,
    version_number: overrides.version_number ?? 1,
    kind: overrides.kind ?? ('autosave' as const),
    commit_message: null,
    created_at: new Date(),
    created_by: null,
    state: { id: entityId, name: 'v1' },
    applied_case_revision_id: null
  });

  it('creates and lists entity versions newest-first', async () => {
    const { db, workspace, entity } = await setup();

    await db.catalog.createEntityVersion({
      ...version(entity.id, { version_number: 1 }),
      workspace
    });
    await new Promise(resolve => setTimeout(resolve, 5));
    await db.catalog.createEntityVersion({
      ...version(entity.id, { version_number: 2 }),
      workspace
    });

    const versions = await db.catalog.listEntityVersions(workspace, entity.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]!.version_number).toBe(2);
    expect(versions[1]!.version_number).toBe(1);
  });

  it('associates a record version with the schema version applicable to its state', async () => {
    const { db, workspace, entity } = await setup();
    const schema = (await db.catalog.getSchema(workspace, entity.schema_id))!;
    const schemaVersionId = randomUUID();
    await db.catalog.createSchemaVersion({
      id: schemaVersionId,
      workspace,
      schema_id: schema.id,
      version: 1,
      name: schema.name,
      description: schema.description,
      fields: schema.fields,
      templates: schema.templates ?? [],
      groups: schema.groups ?? [],
      color: schema.color,
      icon: schema.icon,
      change_summary: {},
      created_by: null,
      created_at: new Date('2020-01-01T00:00:00.000Z')
    });

    const created = await db.catalog.createEntityVersion({
      ...version(entity.id),
      workspace,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      state: { id: entity.id, schema_id: schema.id, name: 'v1' }
    });

    expect(created.schema_version_id).toBe(schemaVersionId);
  });

  it('does not prune an autosave referenced by an architecture baseline', async () => {
    const { db, workspace, entity } = await setup();
    const pinned = await db.catalog.createEntityVersion({
      ...version(entity.id, { version_number: 1 }),
      workspace
    });
    const unpinned = await db.catalog.createEntityVersion({
      ...version(entity.id, { version_number: 2 }),
      workspace
    });
    const baselineId = randomUUID();
    const now = new Date();
    await db.baseline.createBaseline({
      id: baselineId,
      workspace,
      name: 'Pinned baseline',
      description: null,
      owner_team_id: null,
      created_by: null,
      effective_at: now,
      scope: { kind: 'workspace' },
      query: null,
      include_planned_changes: false,
      include_overdue_changes: false,
      created_at: now,
      entity_count: 1,
      relation_count: 0
    });
    await db.baseline.insertBaselineRecords([
      {
        workspace,
        baseline_id: baselineId,
        record_kind: 'entity',
        record_id: entity.id,
        record_version_id: pinned.id,
        state: null,
        state_hash: 'pinned',
        position: 0
      }
    ]);

    await db.catalog.pruneAutosaveVersions(workspace, entity.id, 0);

    expect(await db.catalog.getEntityVersionById(workspace, pinned.id)).not.toBeNull();
    expect(await db.catalog.getEntityVersionById(workspace, unpinned.id)).toBeNull();
  });

  it('gets a single version by id', async () => {
    const { db, workspace, entity } = await setup();
    const created = await db.catalog.createEntityVersion({ ...version(entity.id), workspace });

    const found = await db.catalog.getEntityVersionById(workspace, created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.state).toEqual({ id: entity.id, name: 'v1' });

    const missing = await db.catalog.getEntityVersionById(workspace, randomUUID());
    expect(missing).toBeNull();
  });

  it('promotes an autosave version to a saved version', async () => {
    const { db, workspace, entity } = await setup();
    const created = await db.catalog.createEntityVersion({
      ...version(entity.id, { kind: 'autosave' }),
      workspace
    });

    const updated = await db.catalog.updateEntityVersionKind(
      workspace,
      created.id,
      'saved_version',
      'Promoted for release'
    );

    expect(updated).not.toBeNull();
    expect(updated!.kind).toBe('saved_version');
    expect(updated!.commit_message).toBe('Promoted for release');
  });
});
