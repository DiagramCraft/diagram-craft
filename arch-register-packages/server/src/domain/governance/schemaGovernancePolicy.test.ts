import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import {
  ENTITY_CHANGE_POLICY_CASE_KIND,
  ENTITY_DEPRECATION_POLICY_CASE_KIND,
  getSchemaGovernancePolicies,
  getSchemaGovernancePoliciesBySchema,
  upsertSchemaGovernancePolicies
} from './schemaGovernancePolicy';

const row = (caseKind: string, schemaId: string, enabled: boolean) => ({
  id: `${caseKind}:${schemaId}`,
  workspace: 'workspace-1',
  case_kind: caseKind,
  case_subkind: schemaId,
  enabled,
  config: {},
  updated_at: new Date('2026-08-07T00:00:00.000Z'),
  updated_by: null
});

const database = (rows: ReturnType<typeof row>[]) => {
  const configRows = [...rows];
  const governanceCaseConfig = {
    getCaseConfig: async (_workspace: string, caseKind: string, subkind: string | null) =>
      configRows.find(item => item.case_kind === caseKind && item.case_subkind === subkind) ?? null,
    listCaseConfig: async (_workspace: string) => configRows,
    upsertCaseConfig: async (input: (typeof configRows)[number]) => {
      const existing = configRows.find(
        item => item.case_kind === input.case_kind && item.case_subkind === input.case_subkind
      );
      if (existing) Object.assign(existing, input);
      else configRows.push({ ...input, id: `${input.case_kind}:${input.case_subkind}` });
      return configRows[configRows.length - 1]!;
    }
  };
  return { governanceCaseConfig } as unknown as DatabaseAdapter;
};

describe('schema governance policy storage', () => {
  it('resolves independent policies per schema', async () => {
    const db = database([
      row(ENTITY_CHANGE_POLICY_CASE_KIND, 'schema-1', true),
      row(ENTITY_DEPRECATION_POLICY_CASE_KIND, 'schema-1', false),
      row(ENTITY_DEPRECATION_POLICY_CASE_KIND, 'schema-2', true)
    ]);

    await expect(getSchemaGovernancePolicies(db, 'workspace-1', 'schema-1')).resolves.toEqual({
      entity_approval_policy: 'required',
      deprecation_policy: 'disabled'
    });
    await expect(getSchemaGovernancePoliciesBySchema(db, 'workspace-1')).resolves.toEqual(
      new Map([
        ['schema-1', { entity_approval_policy: 'required', deprecation_policy: 'disabled' }],
        ['schema-2', { entity_approval_policy: 'disabled', deprecation_policy: 'required' }]
      ])
    );
  });

  it('writes both compatibility policy values to the generalized store', async () => {
    const db = database([]);

    await upsertSchemaGovernancePolicies(
      db,
      'workspace-1',
      'schema-1',
      { entity_approval_policy: 'disabled', deprecation_policy: 'required' },
      new Date('2026-08-07T00:00:00.000Z'),
      'user-1'
    );

    await expect(getSchemaGovernancePolicies(db, 'workspace-1', 'schema-1')).resolves.toEqual({
      entity_approval_policy: 'disabled',
      deprecation_policy: 'required'
    });
  });
});
