import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  provisionSqliteDatabase,
  type ProvisionedDatabase
} from '../../db/testSupport/provisionDatabase';
import { createFixtureUser, createFixtureWorkspace } from '../../db/testSupport/fixtures';
import { applyDefinitionImport } from './definitionImportApplier';
import type { DefinitionImportPlan } from './definitionImportTypes';

describe('applyDefinitionImport', () => {
  let provisioned: ProvisionedDatabase;

  beforeEach(async () => {
    provisioned = await provisionSqliteDatabase();
  });

  afterEach(async () => {
    await provisioned.teardown();
  });

  it('keeps the complete application atomic when a later write fails', async () => {
    const workspace = await createFixtureWorkspace(provisioned.db);
    const user = await createFixtureUser(provisioned.db);
    const transaction = vi.spyOn(provisioned.db.core, 'transaction');
    const plan = {
      source: { kind: 'builtin', id: 'template' },
      selection: {
        schemas: ['invalid-schema'],
        enums: ['enum-1'],
        documentTypes: [],
        relationSchemas: [],
        fieldGroups: [],
        dashboard: false
      },
      renames: [],
      schemas: [{
        id: 'invalid-schema',
        name: 'Invalid schema',
        category: null,
        description: '',
        key_prefix: 'ATOMIC',
        fields: [{ id: 'invalid-field', name: 'Invalid field', type: 'text', groupId: 'missing-group' }],
        groups: [],
        shared_field_group_links: [],
        shared_field_groups: [],
        color: null,
        icon: null,
        default_owner_name: null,
        entity_approval_policy: 'disabled',
        deprecation_policy: 'disabled'
      }],
      enums: [{
        id: 'enum-1',
        name: 'Atomic enum',
        options: [{ value: 'one', label: 'One' }],
        sort_order: 0
      }],
      documentTypes: [],
      relationSchemas: [],
      fieldGroups: [],
      capabilityConfigurations: [],
      dashboardWidgets: [],
      dependencyMappings: [],
      schemaPatches: [],
      conflicts: [],
      keyPrefixRemaps: [],
      errors: [],
      fingerprint: '',
      sourceTeamNames: {}
    } as DefinitionImportPlan;

    await expect(
      applyDefinitionImport(
        provisioned.db,
        workspace,
        { userId: user.id } as WorkspaceAuthorizationContext,
        plan
      )
    ).rejects.toThrow(/missing field group/);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(await provisioned.db.catalog.listEnums(workspace)).toEqual([]);
    expect(await provisioned.db.catalog.listSchemas(workspace)).toEqual([]);
  });
});
