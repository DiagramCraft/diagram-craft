import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { computeRetentionExpiry, resolveEntityRetentionStatus } from './retentionStatus';

const now = new Date('2026-08-25T00:00:00.000Z');

describe('computeRetentionExpiry', () => {
  it('is incomplete when duration, time unit, or start date are missing', () => {
    expect(computeRetentionExpiry(null, 'years', '2026-01-01', now)).toEqual({
      expiryDate: null,
      status: 'incomplete'
    });
    expect(computeRetentionExpiry(1, undefined, '2026-01-01', now)).toEqual({
      expiryDate: null,
      status: 'incomplete'
    });
    expect(computeRetentionExpiry(1, 'years', null, now)).toEqual({
      expiryDate: null,
      status: 'incomplete'
    });
    expect(computeRetentionExpiry(1, 'weeks', '2026-01-01', now)).toEqual({
      expiryDate: null,
      status: 'incomplete'
    });
  });

  it('is active when well before expiry', () => {
    expect(computeRetentionExpiry(2, 'years', '2026-01-01', now)).toEqual({
      expiryDate: '2028-01-01',
      status: 'active'
    });
  });

  it('is approaching within the 30-day window before expiry', () => {
    expect(computeRetentionExpiry(1, 'years', '2025-09-01', now)).toEqual({
      expiryDate: '2026-09-01',
      status: 'approaching'
    });
  });

  it('is expired once past the expiry date', () => {
    expect(computeRetentionExpiry(1, 'years', '2025-01-01', now)).toEqual({
      expiryDate: '2026-01-01',
      status: 'expired'
    });
  });
});

const policySchema = {
  id: 'policy-schema',
  fields: [
    { id: 'duration', type: 'number' },
    { id: 'time_unit', type: 'select' }
  ]
};

const assignmentSchema = {
  id: 'assignment-schema',
  fields: [{ id: 'activated_from', type: 'date' }]
};

const makeDb = (overrides: {
  configuration?: unknown;
  relations?: unknown[];
  policyEntity?: unknown;
}) =>
  ({
    workspace: {
      getWorkspaceCapabilityConfiguration: vi.fn(async () => overrides.configuration ?? null)
    },
    catalog: {
      getSchema: vi.fn(async () => policySchema),
      getEntity: vi.fn(async () => overrides.policyEntity ?? null)
    },
    relation: {
      getRelationSchema: vi.fn(async () => assignmentSchema),
      listRelations: vi.fn(async () => ({ items: overrides.relations ?? [], total: 0 }))
    }
  }) as unknown as DatabaseAdapter;

const validConfiguration = {
  id: 'config-1',
  workspace: 'workspace-1',
  type: 'retention',
  bindings: {
    policy: { target: { kind: 'entity_schema', id: 'policy-schema' } },
    assignment: { target: { kind: 'relation_schema', id: 'assignment-schema' } }
  },
  created_at: now,
  updated_at: now
};

describe('resolveEntityRetentionStatus', () => {
  it('returns null when the retention capability is not configured', async () => {
    const db = makeDb({ configuration: null });
    expect(await resolveEntityRetentionStatus(db, 'workspace-1', 'entity-1', now)).toBeNull();
  });

  it('is incomplete when no assignment relation exists for the entity', async () => {
    const db = makeDb({ configuration: validConfiguration, relations: [] });
    expect(await resolveEntityRetentionStatus(db, 'workspace-1', 'entity-1', now)).toEqual({
      expiryDate: null,
      status: 'incomplete'
    });
  });

  it('computes status from the assigned policy entity and relation activation date', async () => {
    const db = makeDb({
      configuration: validConfiguration,
      relations: [
        {
          out_entity_id: 'policy-entity-1',
          data: { activated_from: '2026-01-01' }
        }
      ],
      policyEntity: { data: { duration: 2, time_unit: 'years' } }
    });
    expect(await resolveEntityRetentionStatus(db, 'workspace-1', 'entity-1', now)).toEqual({
      expiryDate: '2028-01-01',
      status: 'active'
    });
  });

  it('is incomplete when the assigned policy entity is missing duration data', async () => {
    const db = makeDb({
      configuration: validConfiguration,
      relations: [{ out_entity_id: 'policy-entity-1', data: { activated_from: '2026-01-01' } }],
      policyEntity: { data: {} }
    });
    expect(await resolveEntityRetentionStatus(db, 'workspace-1', 'entity-1', now)).toEqual({
      expiryDate: null,
      status: 'incomplete'
    });
  });
});
