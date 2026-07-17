import { describe, expect, it } from 'vitest';
import {
  buildCreateMilestoneInput,
  buildUpdateMilestoneInput,
  toApiMilestone
} from './projectMilestoneHelpers';
import type { ProjectMilestoneDbResult } from './db/projectDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');
const nowIso = '2026-06-01T12:00:00.000Z';

const makeRow = (overrides: Partial<ProjectMilestoneDbResult> = {}): ProjectMilestoneDbResult => ({
  id: 'ms-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Q3 platform migration',
  target_date: '2030-07-01',
  status: 'planned',
  sort_order: 0,
  created_at: now,
  updated_at: now,
  ...overrides
});

describe('buildCreateMilestoneInput', () => {
  it('builds a create input with defaults for optional fields', () => {
    const input = buildCreateMilestoneInput(
      'ws-1',
      'proj-1',
      { name: 'Launch', target_date: '2030-01-01' },
      now
    );
    expect(input.workspace).toBe('ws-1');
    expect(input.project_id).toBe('proj-1');
    expect(input.name).toBe('Launch');
    expect(input.target_date).toBe('2030-01-01');
    expect(input.status).toBe('planned');
    expect(input.sort_order).toBe(0);
    expect(input.created_at).toBe(now);
    expect(input.id).toEqual(expect.any(String));
  });

  it('carries through provided status and sort_order', () => {
    const input = buildCreateMilestoneInput(
      'ws-1',
      'proj-1',
      { name: 'Launch', target_date: '2030-01-01', status: 'active', sort_order: 3 },
      now
    );
    expect(input.status).toBe('active');
    expect(input.sort_order).toBe(3);
  });

  it('throws when name is missing', () => {
    expect(() =>
      buildCreateMilestoneInput('ws-1', 'proj-1', { target_date: '2030-01-01' }, now)
    ).toThrow();
  });

  it('throws when target_date is missing', () => {
    expect(() => buildCreateMilestoneInput('ws-1', 'proj-1', { name: 'Launch' }, now)).toThrow();
  });
});

describe('buildUpdateMilestoneInput', () => {
  it('falls back to the existing row for omitted optional fields', () => {
    const existing = makeRow();
    const input = buildUpdateMilestoneInput(
      { name: 'Renamed', target_date: existing.target_date },
      existing,
      now
    );
    expect(input.name).toBe('Renamed');
    expect(input.status).toBe(existing.status);
    expect(input.sort_order).toBe(existing.sort_order);
    expect(input.updated_at).toBe(now);
  });

  it('overrides provided fields', () => {
    const existing = makeRow();
    const input = buildUpdateMilestoneInput(
      { name: 'Renamed', target_date: '2030-12-01', status: 'complete', sort_order: 5 },
      existing,
      now
    );
    expect(input.target_date).toBe('2030-12-01');
    expect(input.status).toBe('complete');
    expect(input.sort_order).toBe(5);
  });

  it('throws when name is missing', () => {
    expect(() =>
      buildUpdateMilestoneInput({ target_date: '2030-01-01' }, makeRow(), now)
    ).toThrow();
  });

  it('throws when target_date is missing', () => {
    expect(() => buildUpdateMilestoneInput({ name: 'Renamed' }, makeRow(), now)).toThrow();
  });
});

describe('toApiMilestone', () => {
  it('maps a db row to the API shape and serializes dates to ISO strings', () => {
    const result = toApiMilestone(makeRow());
    expect(result.id).toBe('ms-1');
    expect(result.project_id).toBe('proj-1');
    expect(result.name).toBe('Q3 platform migration');
    expect(result.target_date).toBe('2030-07-01');
    expect(result.status).toBe('planned');
    expect(result.sort_order).toBe(0);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });
});
