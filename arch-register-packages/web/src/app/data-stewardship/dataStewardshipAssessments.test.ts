import { describe, expect, it } from 'vitest';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  deriveDataStewardshipAssessmentRows,
  deriveDataStewardshipAssessmentSummaries
} from './dataStewardshipAssessments';

const baseAssessment: Assessment = {
  id: 'assess-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'DPIA — loyalty profiling',
  description: '',
  status: 'open',
  mode: 'fields',
  assessment_type_id: 'type-dpia',
  scope: ['data-entity'],
  scope_conditions: [],
  fields: [
    { id: 'q1', label: 'Question 1', requirementLevel: 'required', type: 'text' },
    { id: 'q2', label: 'Question 2', requirementLevel: 'optional', type: 'text' }
  ],
  groups: [],
  assigned_team_ids: [],
  due_at: '2026-01-01T00:00:00.000Z',
  recurrence: { type: 'none' },
  response_window_days: null,
  current_occurrence: 1,
  next_occurrence_at: null,
  response_count: 0,
  completed_entity_count: 0,
  team_acknowledge_status: [],
  created_at: '2025-12-01T00:00:00.000Z',
  updated_at: '2025-12-01T00:00:00.000Z'
};

const entity = (overrides: Partial<EntityRecord>): EntityRecord =>
  ({
    _uid: 'ds-1',
    _publicId: 'DS-001',
    _name: 'Customer profile',
    _owner: { id: 'team-1', name: 'Marketing' },
    steward: null,
    ...overrides
  }) as EntityRecord;

const assessmentTypes: AssessmentType[] = [
  {
    id: 'type-dpia',
    workspace: 'ws-1',
    name: 'DPIA',
    sort_order: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
];

describe('deriveDataStewardshipAssessmentRows', () => {
  it('marks a past-due, incomplete row as overdue', () => {
    const rows = deriveDataStewardshipAssessmentRows({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      responsesByAssessmentId: new Map(),
      assessmentTypes,
      principalLabel: () => undefined
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('overdue');
    expect(rows[0]!.percent).toBe(0);
    expect(rows[0]!.questions).toBe(2);
    expect(rows[0]!.kind).toBe('DPIA');
  });

  it('does not promote a complete row to overdue even when past due', () => {
    const response: AssessmentResponse = {
      id: 'resp-1',
      entity_id: 'ds-1',
      values: { q1: 'answered' },
      status: 'complete',
      updated_at: '2026-01-01T00:00:00.000Z',
      updated_by: null,
      updated_by_name: null
    };
    const rows = deriveDataStewardshipAssessmentRows({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      responsesByAssessmentId: new Map([['assess-1', [response]]]),
      assessmentTypes,
      principalLabel: () => undefined
    });

    expect(rows[0]!.status).toBe('complete');
    expect(rows[0]!.percent).toBe(1);
  });

  it('reports not_started for a future-due assessment with no response', () => {
    const rows = deriveDataStewardshipAssessmentRows({
      assessments: [{ ...baseAssessment, due_at: '2099-01-01T00:00:00.000Z' }],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      responsesByAssessmentId: new Map(),
      assessmentTypes,
      principalLabel: () => undefined
    });

    expect(rows[0]!.status).toBe('not_started');
  });

  it('falls back to Uncategorized when the assessment type is unknown', () => {
    const rows = deriveDataStewardshipAssessmentRows({
      assessments: [{ ...baseAssessment, assessment_type_id: null }],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      responsesByAssessmentId: new Map(),
      assessmentTypes,
      principalLabel: () => undefined
    });

    expect(rows[0]!.kind).toBe('Uncategorized');
  });

  it('prefers the dataset steward over its owner for the owner label, falling back when unset', () => {
    const rowsWithSteward = deriveDataStewardshipAssessmentRows({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map([
        ['assess-1', [entity({ steward: { principal_type: 'user', principal_id: 'user-1' } })]]
      ]),
      responsesByAssessmentId: new Map(),
      assessmentTypes,
      principalLabel: principal => (principal?.principal_id ? 'Priya N.' : undefined)
    });
    expect(rowsWithSteward[0]!.ownerLabel).toBe('Priya N.');

    const rowsWithoutSteward = deriveDataStewardshipAssessmentRows({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map([['assess-1', [entity({ steward: null })]]]),
      responsesByAssessmentId: new Map(),
      assessmentTypes,
      principalLabel: () => undefined
    });
    expect(rowsWithoutSteward[0]!.ownerLabel).toBe('Marketing');
  });

  it('skips assessments with no in-scope entities', () => {
    const rows = deriveDataStewardshipAssessmentRows({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map(),
      responsesByAssessmentId: new Map(),
      assessmentTypes,
      principalLabel: () => undefined
    });
    expect(rows).toHaveLength(0);
  });
});

describe('deriveDataStewardshipAssessmentSummaries', () => {
  it('marks a past-due assessment with an incomplete rollup as overdue', () => {
    const summaries = deriveDataStewardshipAssessmentSummaries({
      assessments: [{ ...baseAssessment, completed_entity_count: 0 }],
      entitiesByAssessmentId: new Map([['assess-1', [entity({}), entity({ _uid: 'ds-2' })]]]),
      assessmentTypes
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.status).toBe('overdue');
    expect(summaries[0]!.percent).toBe(0);
    expect(summaries[0]!.inScopeCount).toBe(2);
    expect(summaries[0]!.kind).toBe('DPIA');
  });

  it('reports complete once completed_entity_count reaches the in-scope count, even if past due', () => {
    const summaries = deriveDataStewardshipAssessmentSummaries({
      assessments: [{ ...baseAssessment, completed_entity_count: 2 }],
      entitiesByAssessmentId: new Map([['assess-1', [entity({}), entity({ _uid: 'ds-2' })]]]),
      assessmentTypes
    });

    expect(summaries[0]!.status).toBe('complete');
    expect(summaries[0]!.percent).toBe(1);
  });

  it('reports in_progress for a partially-complete, not-yet-due assessment', () => {
    const summaries = deriveDataStewardshipAssessmentSummaries({
      assessments: [
        { ...baseAssessment, due_at: '2099-01-01T00:00:00.000Z', completed_entity_count: 1 }
      ],
      entitiesByAssessmentId: new Map([['assess-1', [entity({}), entity({ _uid: 'ds-2' })]]]),
      assessmentTypes
    });

    expect(summaries[0]!.status).toBe('in_progress');
    expect(summaries[0]!.percent).toBe(0.5);
  });

  it('reports not_started for a not-yet-due assessment with no completed responses', () => {
    const summaries = deriveDataStewardshipAssessmentSummaries({
      assessments: [
        { ...baseAssessment, due_at: '2099-01-01T00:00:00.000Z', completed_entity_count: 0 }
      ],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      assessmentTypes
    });

    expect(summaries[0]!.status).toBe('not_started');
  });

  it('falls back to Uncategorized when the assessment type is unknown', () => {
    const summaries = deriveDataStewardshipAssessmentSummaries({
      assessments: [{ ...baseAssessment, assessment_type_id: null }],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      assessmentTypes
    });

    expect(summaries[0]!.kind).toBe('Uncategorized');
  });

  it('skips assessments with no in-scope entities', () => {
    const summaries = deriveDataStewardshipAssessmentSummaries({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map(),
      assessmentTypes
    });
    expect(summaries).toHaveLength(0);
  });
});
