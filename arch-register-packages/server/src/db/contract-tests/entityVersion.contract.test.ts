import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureSchema, createFixtureWorkspace } from './projectFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';

runContractSuiteAgainstBothDrivers('CatalogDatabase entity versions', getDb => {
  const setup = async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);
    const entity = await createFixtureCatalogEntity(db, workspace, schema);
    return { db, workspace, entity };
  };

  const version = (
    entityId: string,
    overrides: Partial<{ version_number: number; kind: 'autosave' | 'saved_version' }> = {}
  ) => ({
    id: randomUUID(),
    workspace: '',
    entity_id: entityId,
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
