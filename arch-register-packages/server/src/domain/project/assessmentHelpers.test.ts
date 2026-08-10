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
  status: 'open',
  mode: 'fields',
  scope: ['schema-service'],
  scope_conditions: [],
  fields: [
    {
      id: 'f1',
      label: 'Auth maturity',
      type: 'enum',
      enumId: 'enum-maturity',
      requirementLevel: 'required'
    }
  ],
  groups: [],
  assigned_team_ids: [],
  due_at: null,
  recurrence: { type: 'none' },
  response_window_days: null,
  current_occurrence: 1,
  pending_occurrence_job_run_id: null,
  next_occurrence_at: null,
  created_at: now,
  updated_at: now,
  ...overrides
});

describe('buildCreateAssessmentInput', () => {
  it('builds a create input with defaults for optional fields', () => {
    const input = buildCreateAssessmentInput(
      'ws-1',
      { project_id: 'proj-1', name: 'New assessment' },
      now
    );
    expect(input.workspace).toBe('ws-1');
    expect(input.project_id).toBe('proj-1');
    expect(input.name).toBe('New assessment');
    expect(input.description).toBe('');
    expect(input.status).toBe('draft');
    expect(input.mode).toBe('fields');
    expect(input.scope).toEqual([]);
    expect(input.scope_conditions).toEqual([]);
    expect(input.fields).toEqual([]);
    expect(input.created_at).toBe(now);
    expect(input.id).toEqual(expect.any(String));
  });

  it('carries through a confirm mode', () => {
    const input = buildCreateAssessmentInput(
      'ws-1',
      { project_id: 'proj-1', name: 'Data confirmation', mode: 'confirm' },
      now
    );
    expect(input.mode).toBe('confirm');
    expect(input.fields).toEqual([]);
  });

  it('carries through provided description, scope, and fields', () => {
    const fields = [{ id: 'f1', label: 'Notes', type: 'text', requirementLevel: 'optional' }];
    const scope_conditions = [{ fieldId: '_owner', op: 'equals' as const, value: 'team-a' }];
    const input = buildCreateAssessmentInput(
      'ws-1',
      {
        project_id: 'proj-1',
        name: 'API Fitness',
        description: 'Rate APIs',
        scope: ['schema-api'],
        scope_conditions,
        fields
      },
      now
    );
    expect(input.description).toBe('Rate APIs');
    expect(input.scope).toEqual(['schema-api']);
    expect(input.scope_conditions).toEqual(scope_conditions);
    expect(input.fields).toEqual(fields);
  });

  it('accepts a derived field referencing a rating sibling', () => {
    const input = buildCreateAssessmentInput(
      'ws-1',
      {
        project_id: 'proj-1',
        name: 'API',
        fields: [
          { id: 'rating', label: 'Rating', requirementLevel: 'required', type: 'rating' },
          {
            id: 'hyper',
            label: 'Hyper',
            requirementLevel: 'optional',
            type: 'derived',
            expression: 'assessment.rating*5',
            resultType: 'number'
          }
        ]
      },
      now
    );

    expect(input.fields).toHaveLength(2);
  });

  it('throws when name is missing', () => {
    expect(() => buildCreateAssessmentInput('ws-1', {}, now)).toThrow();
  });

  it('defaults groups to an empty array when omitted', () => {
    const input = buildCreateAssessmentInput(
      'ws-1',
      { project_id: 'proj-1', name: 'New assessment' },
      now
    );
    expect(input.groups).toEqual([]);
  });

  it('passes through provided groups and clears orphaned field groupIds', () => {
    const input = buildCreateAssessmentInput(
      'ws-1',
      {
        project_id: 'proj-1',
        name: 'New assessment',
        fields: [
          {
            id: 'f1',
            label: 'Notes',
            type: 'text',
            requirementLevel: 'optional',
            groupId: 'missing'
          }
        ],
        groups: [{ id: 'g1', name: 'Basics' }]
      },
      now
    );
    expect(input.groups).toEqual([{ id: 'g1', name: 'Basics' }]);
    expect(input.fields[0]!.groupId).toBeUndefined();
  });
});

describe('buildUpdateAssessmentInput', () => {
  it('falls back to the existing row for omitted optional fields', () => {
    const existing = makeRow();
    const input = buildUpdateAssessmentInput({ name: 'Renamed' }, existing, now);
    expect(input.name).toBe('Renamed');
    expect(input.description).toBe(existing.description);
    expect(input.status).toBe(existing.status);
    expect(input.mode).toBe(existing.mode);
    expect(input.scope).toEqual(existing.scope);
    expect(input.scope_conditions).toEqual(existing.scope_conditions);
    expect(input.fields).toEqual(existing.fields);
    expect(input.updated_at).toBe(now);
  });

  it('overrides provided fields', () => {
    const existing = makeRow();
    const scope_conditions = [
      { fieldId: '_lifecycle', op: 'not_equals' as const, value: 'deprecated' }
    ];
    const input = buildUpdateAssessmentInput(
      { name: 'Renamed', description: 'New desc', scope: [], scope_conditions, fields: [] },
      existing,
      now
    );
    expect(input.description).toBe('New desc');
    expect(input.scope).toEqual([]);
    expect(input.scope_conditions).toEqual(scope_conditions);
    expect(input.fields).toEqual([]);
  });

  it('throws when name is missing', () => {
    expect(() => buildUpdateAssessmentInput({}, makeRow(), now)).toThrow();
  });

  it('falls back to the existing groups when omitted', () => {
    const existing = makeRow({ groups: [{ id: 'g1', name: 'Basics' }] });
    const input = buildUpdateAssessmentInput({ name: 'Renamed' }, existing, now);
    expect(input.groups).toEqual([{ id: 'g1', name: 'Basics' }]);
  });

  it('clears groupId on fields referencing a group removed from groups', () => {
    const existing = makeRow({
      groups: [{ id: 'g1', name: 'Basics' }],
      fields: [
        { id: 'f1', label: 'Notes', type: 'text', requirementLevel: 'optional', groupId: 'g1' }
      ]
    });
    const input = buildUpdateAssessmentInput({ name: 'Renamed', groups: [] }, existing, now);
    expect(input.groups).toEqual([]);
    expect(input.fields[0]!.groupId).toBeUndefined();
  });
});

describe('toApiAssessment', () => {
  it('maps a db row to the API shape and serializes dates to ISO strings', () => {
    const result = toApiAssessment(
      makeRow(),
      { response_count: 3, completed_entity_count: 1 },
      'proj-1'
    );
    expect(result.id).toBe('asmnt-1');
    expect(result.project_id).toBe('proj-1');
    expect(result.scope).toEqual(['schema-service']);
    expect(result.scope_conditions).toEqual([]);
    expect(result.fields).toHaveLength(1);
    expect(result.response_count).toBe(3);
    expect(result.completed_entity_count).toBe(1);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });

  it('passes through groups', () => {
    const result = toApiAssessment(
      makeRow({ groups: [{ id: 'g1', name: 'Basics' }] }),
      { response_count: 0, completed_entity_count: 0 },
      'proj-1'
    );
    expect(result.groups).toEqual([{ id: 'g1', name: 'Basics' }]);
  });
});
