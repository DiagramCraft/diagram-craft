import { describe, expect, it } from 'vitest';
import { seedIntegrationSyncData } from './integrationSync';
import { INTEGRATION_SYNC_IDS, WORKSPACE_ID } from './constants';
import { provisionSqliteDatabase } from '../testSupport/provisionDatabase';
import { seedEntities } from './entities';
import {
  seedCatalogDefinitions,
  seedCatalogEntities,
  seedWorkspaceBase,
  seedWorkspaceConfiguration
} from '../seedPhases';

describe('integration sync seed data', () => {
  it('provides complete, partial, missing, stale, and orphaned control-center states', async () => {
    const provisioned = await provisionSqliteDatabase();
    try {
      await seedWorkspaceBase(provisioned.db);
      await seedWorkspaceConfiguration(provisioned.db, {
        supportedCurrencies: false,
        projectEntityTypes: false,
        assessmentTypes: false
      });
      await seedCatalogDefinitions(provisioned.db);
      await seedCatalogEntities(
        provisioned.db,
        seedEntities.filter(entity => entity.id === '00000000-0000-0000-0004-000000000001')
      );
      await seedIntegrationSyncData(provisioned.db);

      const sources = await provisioned.db.integrationSync.listSources(WORKSPACE_ID);
      const runs = await provisioned.db.integrationSync.listRuns(WORKSPACE_ID, 20);
      const records = await provisioned.db.integrationSync.listManagedRecords(WORKSPACE_ID);

      expect(sources).toHaveLength(2);
      expect(runs.map(run => run.coverage)).toEqual(
        expect.arrayContaining(['complete', 'partial'])
      );
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: INTEGRATION_SYNC_IDS.records.missingService,
            state: 'missing'
          }),
          expect.objectContaining({
            id: INTEGRATION_SYNC_IDS.records.staleApi,
            state: 'stale',
            failure_count: 2
          }),
          expect.objectContaining({
            id: INTEGRATION_SYNC_IDS.records.orphanedRelation,
            state: 'orphaned'
          })
        ])
      );
    } finally {
      await provisioned.teardown();
    }
  });
});
