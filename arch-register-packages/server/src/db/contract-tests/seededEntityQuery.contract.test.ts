import { expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { seedBootstrapData } from '../bootstrapSeed';
import { seededEntities, seededProjects, seededWorkspaces } from '../seedFixtures';
import { seedEntities } from '../seedData/entities';
import { seedSchemas } from '../seedData/catalog';
import { seedProjects } from '../seedData/projects';
import type { StorageAdapter } from '../../storage/storage.types';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  listEntitiesWithCount,
  listRelationsWithCount
} from '../../domain/catalog/entityQueryOperations';
import { getEntityJsonProjection } from '../../domain/catalog/entityProjectionOperations';

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

    expect(new Set((await db.workspace.listWorkspaces()).map(row => row.id))).toEqual(
      new Set(Object.values(seededWorkspaces).map(row => row.id))
    );
    expect(new Set((await db.catalog.listSchemas(workspace)).map(row => row.id))).toEqual(
      new Set(seedSchemas.filter(schema => schema.workspace === workspace).map(schema => schema.id))
    );
    expect(new Set((await db.catalog.listEntities(workspace)).map(row => row.id))).toEqual(
      new Set(
        seedEntities.filter(entity => entity.workspace === workspace).map(entity => entity.id)
      )
    );
    expect(new Set((await db.project.projects.listProjects(workspace)).map(row => row.id))).toEqual(
      new Set(
        seedProjects.filter(project => project.workspace === workspace).map(project => project.id)
      )
    );

    const eolView = await db.view.getSavedView(workspace, '00000000-0000-0000-0020-000000000007');
    const eolQuery = eolView?.filters;
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

    const customerPortal = await db.catalog.getEntity(
      workspace,
      seededEntities.default.customerPortal.id
    );
    const acmeLicense = await db.catalog.getEntity(
      workspace,
      seededEntities.default.acmeContract.id
    );
    const acmeSupport = await db.catalog.getEntity(
      workspace,
      seededEntities.default.acmeSupportContract.id
    );
    expect(customerPortal?.data.budget).toBe(87000);
    expect(acmeLicense?.data.allocated).toBe(60);
    expect(acmeSupport?.data.allocated).toBe(40);

    const customerPortalProjection = await getEntityJsonProjection(
      db,
      workspace,
      seededEntities.default.customerPortal.id,
      1,
      null
    );
    expect(customerPortalProjection.contracts).toHaveLength(2);

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
    expect(result.total).toBe(7);

    const authMigrationAdapter = result.items.find(
      item => item._uid === seededEntities.default.authMigrationAdapter.id
    ) as { _uid: string; _projectId: string | null } | undefined;
    expect(authMigrationAdapter).toMatchObject({
      _uid: seededEntities.default.authMigrationAdapter.id,
      _projectId: seededProjects.authMigration.id
    });

    // #3066: information-governance canonical views, run through the real query engine against
    // this same seed dataset's deliberately-varied governance fixtures (see relations.ts/entities.ts
    // comments: restricted/cross-boundary/residency-invalid Data Flows, and complete/partial/missing
    // stewardship + approaching/overdue review Data Entities).
    const runTableView = async (viewId: string) => {
      const view = await db.view.getSavedView(workspace, viewId);
      expect(view).toBeDefined();
      expect(view?.is_admin_view).toBe(true);
      if (view?.filters.root_kind === 'relation') {
        return listRelationsWithCount(db, workspace, null, {
          relationQuery: view.filters,
          view: 'full'
        });
      }
      return listEntitiesWithCount(db, workspace, null, {
        entityQuery: view!.filters,
        view: 'full'
      });
    };

    const restricted = await runTableView('00000000-0000-0000-0020-000000000009');
    expect(restricted.total).toBe(2);
    expect(new Set(restricted.items.map(item => item._uid))).toEqual(
      new Set(['00000000-0000-0000-0009-000000000001', '00000000-0000-0000-0009-000000000003'])
    );

    const missingStewardship = await runTableView('00000000-0000-0000-0020-00000000000b');
    expect(missingStewardship.total).toBe(2);
    expect(new Set(missingStewardship.items.map(item => item._uid))).toEqual(
      new Set(['00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0008-000000000003'])
    );

    const reviewOverdue = await runTableView('00000000-0000-0000-0020-00000000000c');
    expect(reviewOverdue.total).toBe(1);
    expect(reviewOverdue.items[0]?._uid).toBe('00000000-0000-0000-0008-000000000002');

    const crossBoundary = await runTableView('00000000-0000-0000-0020-00000000000d');
    expect(crossBoundary.total).toBe(1);
    expect(crossBoundary.items[0]?._uid).toBe('00000000-0000-0000-0009-000000000001');

    const residencyInvalid = await runTableView('00000000-0000-0000-0020-00000000000f');
    expect(residencyInvalid.total).toBe(1);
    expect(residencyInvalid.items[0]?._uid).toBe('00000000-0000-0000-0009-000000000001');

    // #3069: information assets with no inbound Risk (risk-affects) or Control (control-affects)
    // link. In this seed dataset only Data Entity DE-2 (Transaction Events) has neither.
    const uncoveredAssets = await runTableView('00000000-0000-0000-0020-000000000012');
    expect(uncoveredAssets.total).toBe(1);
    expect(uncoveredAssets.items[0]?._uid).toBe('00000000-0000-0000-0008-000000000002');
  });
});
