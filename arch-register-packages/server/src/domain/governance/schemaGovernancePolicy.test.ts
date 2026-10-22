import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import {
  ENTITY_CHANGE_POLICY_CASE_KIND,
  ENTITY_DEPRECATION_POLICY_CASE_KIND,
  getRelationApprovalPolicy,
  getRelationApprovalPoliciesBySchema,
  getSchemaGovernancePolicies,
  getSchemaGovernancePoliciesBySchema,
  RELATION_CHANGE_POLICY_CASE_KIND,
  upsertRelationApprovalPolicy,
  upsertSchemaGovernancePolicies
} from './schemaGovernancePolicy';

const row = (caseKind: string, schemaId: string, enabled: boolean, scope = [schemaId]) => ({
  id: `${caseKind}:${schemaId}`,
  workspace: 'workspace-1',
  case_kind: caseKind,
  name: caseKind,
  description: null,
  case_subkinds: scope,
  enabled,
  config: {},
  updated_at: new Date('2026-08-07T00:00:00.000Z'),
  updated_by: null
});

type Row = ReturnType<typeof row>;

const database = (rows: Row[]) => {
  const configRows = [...rows];
  let nextId = 1;
  const governanceCaseConfig = {
    getCaseConfig: async (_workspace: string, caseKind: string, subkind: string | null) =>
      configRows.find(
        item =>
          item.case_kind === caseKind &&
          (subkind == null ? item.case_subkinds.length === 0 : item.case_subkinds.includes(subkind))
      ) ?? null,
    listCaseConfig: async (_workspace: string) => configRows,
    upsertCaseConfig: async (input: Omit<Row, 'id'> & { id?: string }) => {
      const existing = configRows.find(
        item =>
          item.id === input.id ||
          (input.id == null &&
            item.case_kind === input.case_kind &&
            item.case_subkinds.includes(input.case_subkinds[0]!))
      );
      if (existing) {
        Object.assign(existing, input);
        return existing;
      }
      const created = { ...input, id: input.id ?? `generated-${nextId++}` } as Row;
      configRows.push(created);
      return created;
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

describe('relation approval policy storage', () => {
  it('round-trips through the relation.change-case config row, independent of entity policies', async () => {
    const db = database([row(ENTITY_CHANGE_POLICY_CASE_KIND, 'schema-1', true)]);

    await expect(getRelationApprovalPolicy(db, 'workspace-1', 'schema-1')).resolves.toBe(
      'disabled'
    );

    await upsertRelationApprovalPolicy(db, 'workspace-1', 'schema-1', 'required', new Date(), 'u1');

    await expect(getRelationApprovalPolicy(db, 'workspace-1', 'schema-1')).resolves.toBe(
      'required'
    );
    await expect(getRelationApprovalPoliciesBySchema(db, 'workspace-1')).resolves.toEqual(
      new Map([['schema-1', 'required']])
    );
    expect(
      (await db.governanceCaseConfig.listCaseConfig('workspace-1')).map(item => item.case_kind)
    ).toContain(RELATION_CHANGE_POLICY_CASE_KIND);
  });
});

describe('policies for schemas sharing a workflow', () => {
  const shared = () =>
    database([
      row(ENTITY_CHANGE_POLICY_CASE_KIND, 'schema-1', true, ['schema-1', 'schema-2']),
      row(ENTITY_CHANGE_POLICY_CASE_KIND, 'schema-3', false)
    ]);

  it('reports the shared workflow policy for every attached schema', async () => {
    await expect(getSchemaGovernancePoliciesBySchema(shared(), 'workspace-1')).resolves.toEqual(
      new Map([
        ['schema-1', { entity_approval_policy: 'required', deprecation_policy: 'disabled' }],
        ['schema-2', { entity_approval_policy: 'required', deprecation_policy: 'disabled' }],
        ['schema-3', { entity_approval_policy: 'disabled', deprecation_policy: 'disabled' }]
      ])
    );
  });

  it('splits a schema out of the shared workflow when its policy differs', async () => {
    const db = shared();

    await upsertSchemaGovernancePolicies(
      db,
      'workspace-1',
      'schema-2',
      { entity_approval_policy: 'disabled', deprecation_policy: 'disabled' },
      new Date(),
      'u1'
    );

    await expect(getSchemaGovernancePolicies(db, 'workspace-1', 'schema-2')).resolves.toMatchObject(
      { entity_approval_policy: 'disabled' }
    );
    await expect(getSchemaGovernancePolicies(db, 'workspace-1', 'schema-1')).resolves.toMatchObject(
      { entity_approval_policy: 'required' }
    );
    const scopes = (await db.governanceCaseConfig.listCaseConfig('workspace-1'))
      .filter(item => item.case_kind === ENTITY_CHANGE_POLICY_CASE_KIND)
      .map(item => item.case_subkinds);
    expect(scopes).toEqual(expect.arrayContaining([['schema-1'], ['schema-2'], ['schema-3']]));
  });

  it('keeps the shared workflow untouched when the policy already matches', async () => {
    const db = shared();

    await upsertSchemaGovernancePolicies(
      db,
      'workspace-1',
      'schema-2',
      { entity_approval_policy: 'required', deprecation_policy: 'disabled' },
      new Date(),
      'u1'
    );

    const scopes = (await db.governanceCaseConfig.listCaseConfig('workspace-1'))
      .filter(item => item.case_kind === ENTITY_CHANGE_POLICY_CASE_KIND)
      .map(item => item.case_subkinds);
    expect(scopes).toEqual(expect.arrayContaining([['schema-1', 'schema-2']]));
  });
});
