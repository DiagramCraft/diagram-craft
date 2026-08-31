import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('GovernanceCaseConfigDatabase', getDb => {
  describe('workspace-wide config (case_subkind: null)', () => {
    it('upserts and reads back config', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        name: 'Entity deprecation review',
        description: 'Review deprecation requests before archival.',
        enabled: true,
        config: { approaching_days: [7, 3], overdue_days: [1] },
        updated_at: new Date(),
        updated_by: null
      });
      expect(created.case_subkind).toBeNull();
      expect(created.name).toBe('Entity deprecation review');
      expect(created.description).toBe('Review deprecation requests before archival.');
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
        name: 'Initial name',
        description: 'Initial description',
        enabled: true,
        config: { approaching_days: [7] },
        updated_at: new Date(),
        updated_by: null
      });

      const second = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        name: 'Updated name',
        description: 'Updated description',
        enabled: false,
        config: { approaching_days: [14] },
        updated_at: new Date(),
        updated_by: null
      });

      expect(second.id).toBe(first.id);
      expect(second.enabled).toBe(false);
      expect(second.name).toBe('Updated name');
      expect(second.description).toBe('Updated description');
      expect(second.config).toEqual({ approaching_days: [14] });

      const cleared = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: null,
        name: 'Final name',
        description: null,
        enabled: false,
        config: { approaching_days: [28] },
        updated_at: new Date(),
        updated_by: null
      });
      expect(cleared.name).toBe('Final name');
      expect(cleared.description).toBeNull();

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
        name: 'Workspace field reminders',
        enabled: true,
        config: { approaching_days: [7] },
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: 'Contract.end_date',
        name: 'Contract review date',
        description: 'Remind the contract owner before the review date.',
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
      expect(scoped?.name).toBe('Contract review date');
      expect(scoped?.description).toBe('Remind the contract owner before the review date.');

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
        name: 'Initial field reminder',
        enabled: true,
        config: { approaching_days: [30] },
        updated_at: new Date(),
        updated_by: null
      });
      const updated = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: 'Contract.end_date',
        name: 'Updated field reminder',
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
        name: 'Deprecation review',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'relation.change-case',
        case_subkind: null,
        name: 'Relation review',
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
        name: 'Workspace A deprecation',
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

  describe('deleteCaseConfigForSubkindOrDescendants', () => {
    it('deleting a root removes the root row and every field-scoped row nested under it', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schemaId = 'schema-1';

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: schemaId,
        name: 'Schema deprecation',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: `${schemaId}:field-a`,
        name: 'Field A reminder',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: `${schemaId}:field-b`,
        name: 'Field B reminder',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });

      const deleted = await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(
        workspace,
        schemaId
      );
      expect(deleted).toBe(3);
      expect(await db.governanceCaseConfig.listCaseConfig(workspace)).toEqual([]);
    });

    it('deleting an exact field subkind only removes that row', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schemaId = 'schema-1';

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: schemaId,
        name: 'Schema reminder',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkind: `${schemaId}:field-a`,
        name: 'Field A reminder',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });

      const deleted = await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(
        workspace,
        `${schemaId}:field-a`
      );
      expect(deleted).toBe(1);

      const remaining = await db.governanceCaseConfig.listCaseConfig(workspace);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.case_subkind).toBe(schemaId);
    });

    it('leaves other roots and other workspaces untouched', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const otherWorkspace = await createFixtureWorkspace(db);

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: 'schema-1',
        name: 'Schema 1 deprecation',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkind: 'schema-2',
        name: 'Schema 2 deprecation',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace: otherWorkspace,
        case_kind: 'entity.deprecation',
        case_subkind: 'schema-1',
        name: 'Other workspace deprecation',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });

      const deleted = await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(
        workspace,
        'schema-1'
      );
      expect(deleted).toBe(1);

      expect(
        (await db.governanceCaseConfig.listCaseConfig(workspace)).map(r => r.case_subkind)
      ).toEqual(['schema-2']);
      expect(
        (await db.governanceCaseConfig.listCaseConfig(otherWorkspace)).map(r => r.case_subkind)
      ).toEqual(['schema-1']);
    });
  });
});
