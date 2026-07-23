import { expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { seedBootstrapData } from '../bootstrapSeed';
import { seededEntities, seededProjects, seededWorkspaces } from '../seedFixtures';
import type { StorageAdapter } from '../../storage/storage.types';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { listEntitiesWithCount } from '../../domain/catalog/entityQueryOperations';

const noopStorage: StorageAdapter = {
  read: async () => Buffer.alloc(0),
  write: async () => {},
  delete: async () => {},
  deleteAll: async () => {},
  stageWrite: async () => ({
    commit: async () => {},
    rollback: async () => {},
    finalize: async () => {}
  }),
  stageDelete: async () => ({
    commit: async () => {},
    rollback: async () => {},
    finalize: async () => {}
  })
};

runContractSuiteAgainstBothDrivers('seededEntityQuery', getDb => {
  it('executes the seeded #2300 and #2315 worked examples through list/count', async () => {
    const db = getDb();
    await seedBootstrapData(db, noopStorage);
    const workspace = seededWorkspaces.default.id;

    const eolView = await db.view.getSavedView(workspace, '00000000-0000-0000-0020-000000000007');
    const eolQuery = eolView?.filters.entityQuery;
    expect(eolQuery).toBeDefined();
    expect(eolView?.is_admin_view).toBe(true);
    const eolResults = await listEntitiesWithCount(db, workspace, null, {
      entityQuery: eolQuery as EntityQuery,
      view: 'full'
    });
    expect(eolResults.total).toBe(11);
    expect(eolResults.items[0]?._projections).toMatchObject({
      technology_release_eol: expect.any(Array)
    });

    const identityAnchoredQuery: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [
          { kind: 'forward', fieldId: 'technology_releases' },
          { kind: 'forward', fieldId: 'technology' }
        ],
        fieldId: '_id',
        op: 'equals',
        value: '00000000-0000-0000-0007-000000000003'
      }
    };
    const identityResults = await listEntitiesWithCount(db, workspace, null, {
      entityQuery: identityAnchoredQuery,
      view: 'summary'
    });
    expect(identityResults.total).toBe(4);

    const result = await listEntitiesWithCount(db, seededWorkspaces.default.id, null, {
      projectId: seededProjects.authMigration.id,
      projectScope: 'project',
      view: 'summary'
    });
    expect(result.total).toBe(6);

    const authMigrationAdapter = result.items.find(
      item => item._uid === seededEntities.default.authMigrationAdapter.id
    ) as { _uid: string; _projectId: string | null } | undefined;
    expect(authMigrationAdapter).toMatchObject({
      _uid: seededEntities.default.authMigrationAdapter.id,
      _projectId: seededProjects.authMigration.id
    });
  });
});
