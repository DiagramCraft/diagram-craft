import { describe, expect, it } from 'vitest';
import {
  buildCreateAssessmentInput,
  buildUpdateAssessmentInput,
  toApiAssessment
} from './assessmentHelpers';
import type { AssessmentDbResult } from './db/projectDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');
const nowIso = '2026-06-01T12:00:00.000Z';

const makeRow = (overrides: Partial<AssessmentDbResult> = {}): AssessmentDbResult => ({
  id: 'asmnt-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Security Readiness',
  description: 'Assess security posture',
  status: 'active',
  scope: ['schema-service'],
  fields: [{ id: 'f1', label: 'Auth maturity', type: 'enum', enumId: 'enum-maturity', requirementLevel: 'required' }],
  created_at: now,
  updated_at: now,
  ...overrides
});

describe('buildCreateAssessmentInput', () => {
  it('builds a create input with defaults for optional fields', () => {
    const input = buildCreateAssessmentInput('ws-1', 'proj-1', { name: 'New assessment' }, now);
    expect(input.workspace).toBe('ws-1');
    expect(input.project_id).toBe('proj-1');
    expect(input.name).toBe('New assessment');
    expect(input.description).toBe('');
    expect(input.status).toBe('active');
    expect(input.scope).toEqual([]);
    expect(input.fields).toEqual([]);
    expect(input.created_at).toBe(now);
    expect(input.id).toEqual(expect.any(String));
  });

  it('carries through provided description, scope, and fields', () => {
    const fields = [{ id: 'f1', label: 'Notes', type: 'text', requirementLevel: 'optional' }];
    const input = buildCreateAssessmentInput(
      'ws-1',
      'proj-1',
      { name: 'API Fitness', description: 'Rate APIs', scope: ['schema-api'], fields },
      now
    );
    expect(input.description).toBe('Rate APIs');
    expect(input.scope).toEqual(['schema-api']);
    expect(input.fields).toEqual(fields);
  });

  it('throws when name is missing', () => {
    expect(() => buildCreateAssessmentInput('ws-1', 'proj-1', {}, now)).toThrow();
  });
});

describe('buildUpdateAssessmentInput', () => {
  it('falls back to the existing row for omitted optional fields', () => {
    const existing = makeRow();
    const input = buildUpdateAssessmentInput({ name: 'Renamed' }, existing, now);
    expect(input.name).toBe('Renamed');
    expect(input.description).toBe(existing.description);
    expect(input.status).toBe(existing.status);
    expect(input.scope).toEqual(existing.scope);
    expect(input.fields).toEqual(existing.fields);
    expect(input.updated_at).toBe(now);
  });

  it('overrides provided fields', () => {
    const existing = makeRow();
    const input = buildUpdateAssessmentInput(
      { name: 'Renamed', description: 'New desc', scope: [], fields: [] },
      existing,
      now
    );
    expect(input.description).toBe('New desc');
    expect(input.scope).toEqual([]);
    expect(input.fields).toEqual([]);
  });

  it('throws when name is missing', () => {
    expect(() => buildUpdateAssessmentInput({}, makeRow(), now)).toThrow();
  });
});

describe('toApiAssessment', () => {
  it('maps a db row to the API shape and serializes dates to ISO strings', () => {
    const result = toApiAssessment(makeRow());
    expect(result.id).toBe('asmnt-1');
    expect(result.project_id).toBe('proj-1');
    expect(result.scope).toEqual(['schema-service']);
    expect(result.fields).toHaveLength(1);
    expect(result.response_count).toBe(0);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });
});
