import { describe, expect, it } from 'vitest';
import { buildRetentionAssignmentRows } from './useRetentionAssignments';
import type { RetentionFieldIds } from './riskComplianceQueries';

const fieldIds: RetentionFieldIds = {
  durationFieldId: 'duration',
  timeUnitFieldId: 'time_unit',
  activatedFromFieldId: 'activated_from'
};

const policy = (id: string, overrides: Record<string, unknown> = {}) => ({
  _uid: id,
  _publicId: id,
  _name: `Policy ${id}`,
  duration: 1,
  time_unit: 'years',
  ...overrides
});

const assignment = (id: string, policyId: string, overrides: Record<string, unknown> = {}) => ({
  _uid: id,
  _in: { id: `entity-${id}`, name: `Entity ${id}` },
  _out: { id: policyId, name: `Policy ${policyId}` },
  activated_from: '2026-01-01',
  ...overrides
});

describe('buildRetentionAssignmentRows', () => {
  it('joins assignments to their governing policy and reports its period as a plain fact', () => {
    const policiesById = new Map([['policy-1', policy('policy-1') as never]]);
    const rows = buildRetentionAssignmentRows(
      [assignment('assignment-1', 'policy-1') as never],
      policiesById,
      fieldIds
    );

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.governedEntityName).toBe('Entity assignment-1');
    expect(row.policyName).toBe('Policy policy-1');
    expect(row.policyPeriod).toBe('1 years');
    expect(row.activatedFrom).toBe('2026-01-01');
    expect(row.policyId).toBe('policy-1');
    expect(row.missing).toEqual([]);
  });

  it('reports what is missing when the governing policy has no duration data', () => {
    const policiesById = new Map([
      ['policy-1', policy('policy-1', { duration: undefined }) as never]
    ]);
    const rows = buildRetentionAssignmentRows(
      [assignment('assignment-1', 'policy-1') as never],
      policiesById,
      fieldIds
    );

    expect(rows[0]!.missing).toEqual(['duration']);
    expect(rows[0]!.policyPeriod).toBeNull();
  });

  it('reports every missing field when the policy is unresolvable and the date is blank', () => {
    const rows = buildRetentionAssignmentRows(
      [assignment('assignment-1', 'policy-1', { activated_from: undefined }) as never],
      new Map(),
      fieldIds
    );

    expect(rows[0]!.missing).toEqual(['policy', 'duration', 'time unit', 'activation date']);
  });
});
