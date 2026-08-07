import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';

runContractSuiteAgainstBothDrivers('GovernanceCaseConfigDatabase', getDb => {
  describe('workspace-wide config (case_subkind: null)', () => {
    it('upserts and reads back config', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        enabled: true,
        config: { approaching_days: [7, 3], overdue_days: [1] },
        updated_at: new Date(),
        updated_by: null
      });
      expect(created.case_subkind).toBeNull();
      expect(created.config).toEqual({ approaching_days: [7, 3], overdue_days: [1] });

      const fetched = await db.governanceCaseConfig.getCaseConfig(
        workspace,
        'entity.deprecation',
        null
      );
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.enabled).toBe(true);
    });

    it('re-upserting the same (workspace, case_kind, null subkind) updates in place', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const first = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        enabled: true,
        config: { approaching_days: [7] },
        updated_at: new Date(),
        updated_by: null
      });

      const second = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        enabled: false,
        config: { approaching_days: [14] },
        updated_at: new Date(),
        updated_by: null
      });

      expect(second.id).toBe(first.id);
      expect(second.enabled).toBe(false);
      expect(second.config).toEqual({ approaching_days: [14] });

      const rows = await db.governanceCaseConfig.listCaseConfigForKind(
        workspace,
        'entity.deprecation'
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe('subkind-scoped config', () => {
    it('keeps null-subkind and named-subkind rows for the same case_kind distinct', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: null,
        enabled: true,
        config: { approaching_days: [7] },
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: 'Contract.end_date',
        enabled: true,
        config: { approaching_days: [30] },
        updated_at: new Date(),
        updated_by: null
      });

      const rows = await db.governanceCaseConfig.listCaseConfigForKind(
        workspace,
        'field-date-reminder'
      );
      expect(rows).toHaveLength(2);

      const scoped = await db.governanceCaseConfig.getCaseConfig(
        workspace,
        'field-date-reminder',
        'Contract.end_date'
      );
      expect(scoped?.config).toEqual({ approaching_days: [30] });

      const workspaceWide = await db.governanceCaseConfig.getCaseConfig(
        workspace,
        'field-date-reminder',
        null
      );
      expect(workspaceWide?.config).toEqual({ approaching_days: [7] });
    });

    it('re-upserting a named subkind updates that row only', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: 'Contract.end_date',
        enabled: true,
        config: { approaching_days: [30] },
        updated_at: new Date(),
        updated_by: null
      });
      const updated = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: 'Contract.end_date',
        enabled: false,
        config: { approaching_days: [45] },
        updated_at: new Date(),
        updated_by: null
      });

      const rows = await db.governanceCaseConfig.listCaseConfigForKind(
        workspace,
        'field-date-reminder'
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(updated.id);
      expect(rows[0]?.enabled).toBe(false);
    });
  });

  describe('listing', () => {
    it('listCaseConfig returns all rows for a workspace across case kinds', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'relation.change-case',
        case_subkind: null,
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });

      const rows = await db.governanceCaseConfig.listCaseConfig(workspace);
      expect(rows.map(r => r.case_kind).sort()).toEqual([
        'entity.deprecation',
        'relation.change-case'
      ]);
    });

    it('scopes rows to the given workspace', async () => {
      const db = getDb();
      const workspaceA = await createFixtureWorkspace(db);
      const workspaceB = await createFixtureWorkspace(db);

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace: workspaceA,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });

      expect(await db.governanceCaseConfig.listCaseConfig(workspaceB)).toEqual([]);
      expect(
        await db.governanceCaseConfig.getCaseConfig(workspaceB, 'entity.deprecation', null)
      ).toBeNull();
    });
  });
});
