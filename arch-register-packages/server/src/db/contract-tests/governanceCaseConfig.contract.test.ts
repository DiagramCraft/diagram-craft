import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('GovernanceCaseConfigDatabase', getDb => {
  describe('workspace-wide config (no subkinds)', () => {
    it('upserts and reads back config', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkinds: [],
        name: 'Entity deprecation review',
        description: 'Review deprecation requests before archival.',
        enabled: true,
        config: { approaching_days: [7, 3], overdue_days: [1] },
        updated_at: new Date(),
        updated_by: null
      });
      expect(created.case_subkinds).toEqual([]);
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
        case_subkinds: [],
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
        case_subkinds: [],
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
        case_subkinds: [],
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
        case_subkinds: [],
        name: 'Workspace field reminders',
        enabled: true,
        config: { approaching_days: [7] },
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkinds: ['Contract.end_date'],
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
        case_subkinds: ['Contract.end_date'],
        name: 'Initial field reminder',
        enabled: true,
        config: { approaching_days: [30] },
        updated_at: new Date(),
        updated_by: null
      });
      const updated = await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkinds: ['Contract.end_date'],
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
        case_subkinds: [],
        name: 'Deprecation review',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'relation.change-case',
        case_subkinds: [],
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
        case_subkinds: [],
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
        case_subkinds: [schemaId],
        name: 'Schema deprecation',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkinds: [`${schemaId}:field-a`],
        name: 'Field A reminder',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkinds: [`${schemaId}:field-b`],
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
        case_subkinds: [schemaId],
        name: 'Schema reminder',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'field-date-reminder',
        case_subkinds: [`${schemaId}:field-a`],
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
      expect(remaining[0]?.case_subkinds).toEqual([schemaId]);
    });

    it('leaves other roots and other workspaces untouched', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const otherWorkspace = await createFixtureWorkspace(db);

      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkinds: ['schema-1'],
        name: 'Schema 1 deprecation',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: 'entity.deprecation',
        case_subkinds: ['schema-2'],
        name: 'Schema 2 deprecation',
        enabled: true,
        config: {},
        updated_at: new Date(),
        updated_by: null
      });
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace: otherWorkspace,
        case_kind: 'entity.deprecation',
        case_subkinds: ['schema-1'],
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
        (await db.governanceCaseConfig.listCaseConfig(workspace)).flatMap(r => r.case_subkinds)
      ).toEqual(['schema-2']);
      expect(
        (await db.governanceCaseConfig.listCaseConfig(otherWorkspace)).flatMap(r => r.case_subkinds)
      ).toEqual(['schema-1']);
    });
  });
  describe('multi-schema scope', () => {
    const base = (workspace: string, name: string, subkinds: string[]) => ({
      workspace,
      case_kind: 'entity.change-case',
      case_subkinds: subkinds,
      name,
      enabled: true,
      config: {},
      updated_at: new Date(),
      updated_by: null
    });

    it('stores one config for several subkinds and resolves each of them to it', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.governanceCaseConfig.upsertCaseConfig(
        base(workspace, 'Shared', ['schema-b', 'schema-a'])
      );
      expect([...created.case_subkinds].sort()).toEqual(['schema-a', 'schema-b']);

      for (const subkind of ['schema-a', 'schema-b']) {
        const fetched = await db.governanceCaseConfig.getCaseConfig(
          workspace,
          'entity.change-case',
          subkind
        );
        expect(fetched?.id).toBe(created.id);
      }
      expect(
        await db.governanceCaseConfig.listCaseConfigForKind(workspace, 'entity.change-case')
      ).toHaveLength(1);
    });

    it('rejects a config whose scope overlaps another config and names the subkinds', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.governanceCaseConfig.upsertCaseConfig(
        base(workspace, 'First', ['schema-a', 'schema-b'])
      );

      const overlapping = db.governanceCaseConfig.upsertCaseConfig({
        ...base(workspace, 'Second', ['schema-b', 'schema-c']),
        id: '00000000-0000-4000-8000-000000000001'
      });
      await expect(overlapping).rejects.toMatchObject({
        name: 'GovernanceCaseConfigScopeConflictError',
        subkinds: ['schema-b']
      });
      expect(
        await db.governanceCaseConfig.getCaseConfig(workspace, 'entity.change-case', 'schema-c')
      ).toBeNull();
    });

    it('allows the same subkind under different case kinds', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.governanceCaseConfig.upsertCaseConfig(base(workspace, 'Change', ['schema-a']));
      await db.governanceCaseConfig.upsertCaseConfig({
        ...base(workspace, 'Deprecation', ['schema-a']),
        case_kind: 'entity.deprecation'
      });

      expect(await db.governanceCaseConfig.listCaseConfig(workspace)).toHaveLength(2);
    });

    it('updates the scope of an existing config by id, freeing removed subkinds', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const created = await db.governanceCaseConfig.upsertCaseConfig(
        base(workspace, 'Shared', ['schema-a', 'schema-b'])
      );

      const updated = await db.governanceCaseConfig.upsertCaseConfig({
        ...base(workspace, 'Shared', ['schema-a', 'schema-c']),
        id: created.id
      });
      expect(updated.id).toBe(created.id);
      expect([...updated.case_subkinds].sort()).toEqual(['schema-a', 'schema-c']);
      expect(
        await db.governanceCaseConfig.getCaseConfig(workspace, 'entity.change-case', 'schema-b')
      ).toBeNull();

      // schema-b is free again for another config
      const other = await db.governanceCaseConfig.upsertCaseConfig(
        base(workspace, 'Other', ['schema-b'])
      );
      expect(other.id).not.toBe(created.id);
    });

    it('allows only one workspace-wide config per case kind, next to scoped ones', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const wide = await db.governanceCaseConfig.upsertCaseConfig(base(workspace, 'Fallback', []));
      await db.governanceCaseConfig.upsertCaseConfig(base(workspace, 'Scoped', ['schema-a']));

      await expect(
        db.governanceCaseConfig.upsertCaseConfig({
          ...base(workspace, 'Second fallback', []),
          id: '00000000-0000-4000-8000-000000000002'
        })
      ).rejects.toMatchObject({ name: 'GovernanceCaseConfigScopeConflictError', subkinds: [] });

      const fetched = await db.governanceCaseConfig.getCaseConfig(
        workspace,
        'entity.change-case',
        null
      );
      expect(fetched?.id).toBe(wide.id);
    });

    it('deletes a config by id together with its scope', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const created = await db.governanceCaseConfig.upsertCaseConfig(
        base(workspace, 'Shared', ['schema-a', 'schema-b'])
      );

      expect(await db.governanceCaseConfig.deleteCaseConfig(workspace, created.id)).toBe(true);
      expect(await db.governanceCaseConfig.deleteCaseConfig(workspace, created.id)).toBe(false);
      expect(
        await db.governanceCaseConfig.getCaseConfig(workspace, 'entity.change-case', 'schema-a')
      ).toBeNull();
    });

    it('removing a subkind shrinks a shared config and deletes it once its scope is empty', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const created = await db.governanceCaseConfig.upsertCaseConfig(
        base(workspace, 'Shared', ['schema-a', 'schema-b'])
      );

      await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(workspace, 'schema-a');
      const shrunk = await db.governanceCaseConfig.getCaseConfigById(workspace, created.id);
      expect(shrunk?.case_subkinds).toEqual(['schema-b']);

      await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(workspace, 'schema-b');
      expect(await db.governanceCaseConfig.getCaseConfigById(workspace, created.id)).toBeNull();
    });

    it('keeps workspace-wide configs when cleaning up a subkind', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const wide = await db.governanceCaseConfig.upsertCaseConfig(base(workspace, 'Fallback', []));
      await db.governanceCaseConfig.upsertCaseConfig(base(workspace, 'Scoped', ['schema-a']));

      await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(workspace, 'schema-a');

      expect((await db.governanceCaseConfig.getCaseConfigById(workspace, wide.id))?.id).toBe(
        wide.id
      );
    });
  });
});
