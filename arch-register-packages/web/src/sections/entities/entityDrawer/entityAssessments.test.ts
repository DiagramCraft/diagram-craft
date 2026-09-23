import { describe, expect, it } from 'vitest';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { deriveEntityAssessmentRows, deriveEntityAssessmentSummaries } from './entityAssessments';

const baseAssessment: Assessment = {
  id: 'assess-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Periodic review',
  description: '',
  status: 'open',
  mode: 'fields',
  assessment_type_id: 'type-review',
  scope: ['service'],
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
    _uid: 'entity-1',
    _publicId: 'ENT-001',
    _name: 'Customer service',
    _owner: { id: 'team-1', name: 'Operations' },
    ...overrides
  }) as EntityRecord;

const assessmentTypes: AssessmentType[] = [
  {
    id: 'type-review',
    workspace: 'ws-1',
    name: 'Review',
    sort_order: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
];

describe('entity assessment derivation', () => {
  it('derives rows for an arbitrary entity schema', () => {
    const rows = deriveEntityAssessmentRows({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      responsesByAssessmentId: new Map(),
      assessmentTypes
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: { _uid: 'entity-1' },
      kind: 'Review',
      status: 'overdue',
      percent: 0,
      questions: 2
    });
  });

  it('does not mark a completed response overdue', () => {
    const response: AssessmentResponse = {
      id: 'resp-1',
      entity_id: 'entity-1',
      values: { q1: 'answered' },
      status: 'complete',
      updated_at: '2026-01-01T00:00:00.000Z',
      updated_by: null,
      updated_by_name: null
    };
    const rows = deriveEntityAssessmentRows({
      assessments: [baseAssessment],
      entitiesByAssessmentId: new Map([['assess-1', [entity({})]]]),
      responsesByAssessmentId: new Map([['assess-1', [response]]]),
      assessmentTypes
    });

    expect(rows[0]).toMatchObject({ status: 'complete', percent: 1 });
  });

  it('derives aggregate summaries and skips assessments with no matching entities', () => {
    const summaries = deriveEntityAssessmentSummaries({
      assessments: [
        { ...baseAssessment, due_at: '2099-01-01T00:00:00.000Z', completed_entity_count: 1 },
        { ...baseAssessment, id: 'empty-assessment' }
      ],
      entitiesByAssessmentId: new Map([
        ['assess-1', [entity({}), entity({ _uid: 'entity-2' })]],
        ['empty-assessment', []]
      ]),
      assessmentTypes
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      status: 'in_progress',
      percent: 0.5,
      inScopeCount: 2,
      kind: 'Review'
    });
  });
});
