import { expect, it } from 'vitest';
import { seedBootstrapData } from '../bootstrapSeed';
import { seededWorkspaces } from '../seedFixtures';
import { SEED_SCHEMA_IDS } from '../seedData/constants';
import { demoChangeCases } from '../seedData/demoChangeCases';
import { getSchemaGovernancePolicies } from '../../domain/governance/schemaGovernancePolicy';
import type { StorageAdapter } from '../../storage/storage.types';
import { runContractSuiteAgainstBothDrivers } from './harness';

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

runContractSuiteAgainstBothDrivers('seededChangeCases', getDb => {
  it('seeds Data Entity change cases and enables the Data Entity approval workflow in the demo dataset', async () => {
    const db = getDb();
    await db.core.transaction(seedDb =>
      seedBootstrapData(seedDb, noopStorage, { dataset: 'demo' })
    );
    const workspace = seededWorkspaces.default.id;

    expect(
      (await getSchemaGovernancePolicies(db, workspace, SEED_SCHEMA_IDS.dataEntity))
        .entity_approval_policy
    ).toBe('required');

    const cases = (await db.governance.listCases(workspace)).filter(
      row => row.case_kind === 'entity.change-case'
    );
    expect(cases).toHaveLength(demoChangeCases.length);
    expect(new Set(cases.map(row => row.status))).toEqual(new Set(['open', 'completed', 'cancelled']));
    expect(cases.filter(row => row.status === 'open').some(row => row.due_at && row.due_at < new Date())).toBe(true);

    for (const row of cases) {
      const entity = await db.catalog.getEntity(workspace, row.subject_id);
      expect(entity?.schema_id).toBe(SEED_SCHEMA_IDS.dataEntity);
      expect((await db.governance.listAssignmentsForCase(row.id)).length).toBeGreaterThan(0);
    }
  });
});
