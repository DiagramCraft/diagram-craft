import { describe, expect, it } from 'vitest';
import { toApiAssessmentResponse, countCompletedEntities } from './assessmentResponseHelpers';
import type { AssessmentDbResult, AssessmentResponseDbResult } from './db/projectDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const makeAssessment = (overrides: Partial<AssessmentDbResult> = {}): AssessmentDbResult => ({
  id: 'asmnt-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Security Readiness',
  description: '',
  status: 'active',
  scope: ['schema-service'],
  fields: [
    { id: 'f1', label: 'Auth maturity', type: 'enum', enumId: 'enum-maturity', requirementLevel: 'required' },
    { id: 'f2', label: 'Notes', type: 'text', requirementLevel: 'optional' }
  ],
  created_at: now,
  updated_at: now,
  ...overrides
});

const makeResponse = (
  overrides: Partial<AssessmentResponseDbResult> = {}
): AssessmentResponseDbResult => ({
  id: 'resp-1',
  workspace: 'ws-1',
  assessment_id: 'asmnt-1',
  entity_id: 'entity-1',
  values: {},
  created_at: now,
  updated_at: now,
  updated_by: null,
  ...overrides
});

describe('toApiAssessmentResponse', () => {
  it('maps a db row and derives status from required fields', () => {
    const assessment = makeAssessment();
    const row = makeResponse({ values: { f1: 'Managed' } });
    const result = toApiAssessmentResponse(row, assessment);
    expect(result.entity_id).toBe('entity-1');
    expect(result.status).toBe('complete');
    expect(result.updated_at).toBe(now.toISOString());
  });

  it('is not_started when no required fields are answered', () => {
    const assessment = makeAssessment();
    const row = makeResponse({ values: { f2: 'some notes' } });
    expect(toApiAssessmentResponse(row, assessment).status).toBe('not_started');
  });

  it('is complete when there are no required fields at all', () => {
    const assessment = makeAssessment({
      fields: [{ id: 'f2', label: 'Notes', type: 'text', requirementLevel: 'optional' }]
    });
    const row = makeResponse({ values: {} });
    expect(toApiAssessmentResponse(row, assessment).status).toBe('complete');
  });
});

describe('countCompletedEntities', () => {
  it('counts only responses whose required fields are all filled', () => {
    const assessment = makeAssessment();
    const responses = [
      makeResponse({ entity_id: 'e1', values: { f1: 'Managed' } }),
      makeResponse({ entity_id: 'e2', values: {} }),
      makeResponse({ entity_id: 'e3', values: { f1: 'Defined', f2: 'note' } })
    ];
    expect(countCompletedEntities(responses, assessment)).toBe(2);
  });
});
