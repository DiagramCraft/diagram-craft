import { describe, expect, it } from 'vitest';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import {
  buildAssessmentFormData,
  canSaveAssessmentDraft,
  createInitialAssessmentEditorDraft,
  getAssessmentRecurrence,
  getResponseWindowDaysNumber,
  uniqueAssessmentFieldId
} from './assessmentEditorState';

const baseAssessment: Assessment = {
  id: 'assessment-1',
  workspace: 'workspace-1',
  project_id: 'project-1',
  name: 'Security readiness',
  description: 'Review the platform',
  status: 'open',
  mode: 'fields',
  assessment_type_id: null,
  scope: ['application'],
  scope_conditions: [{ fieldId: '_lifecycle', op: 'equals', value: 'active' }],
  fields: [
    {
      id: 'risk',
      label: 'Risk',
      type: 'rating',
      requirementLevel: 'required'
    }
  ],
  groups: [{ id: 'governance', name: 'Governance' }],
  assigned_team_ids: ['team-1'],
  due_at: '2026-08-20T00:00:00.000Z',
  recurrence: { type: 'weekly', intervalWeeks: 2 },
  response_window_days: 14,
  current_occurrence: 1,
  next_occurrence_at: null,
  response_count: 3,
  completed_entity_count: 1,
  team_acknowledge_status: [],
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z'
};

describe('assessment editor state helpers', () => {
  it('initializes an editable draft without sharing assessment arrays', () => {
    const draft = createInitialAssessmentEditorDraft(baseAssessment);

    expect(draft).toMatchObject({
      name: 'Security readiness',
      dueAt: '2026-08-20',
      recurrenceType: 'weekly',
      recurrenceInterval: 2,
      responseWindowDays: '14',
      status: 'open'
    });
    expect(draft.scope).not.toBe(baseAssessment.scope);
    expect(draft.fields).not.toBe(baseAssessment.fields);
    expect(draft.groups).not.toBe(baseAssessment.groups);
  });

  it('creates unique field ids while allowing the current id to be reused', () => {
    expect(uniqueAssessmentFieldId('risk', ['risk'])).toBe('risk_2');
    expect(uniqueAssessmentFieldId('risk', ['risk', 'risk_2', 'risk_3'])).toBe('risk_4');
    expect(uniqueAssessmentFieldId('risk', ['risk', 'risk_2'], 'risk')).toBe('risk');
  });

  it('builds recurrence and validates recurring drafts', () => {
    const draft = createInitialAssessmentEditorDraft(null);
    draft.name = 'Quarterly review';
    draft.recurrenceType = 'monthly';
    draft.recurrenceInterval = 3;
    draft.responseWindowDays = '21';

    expect(getAssessmentRecurrence(draft)).toEqual({ type: 'monthly', intervalMonths: 3 });
    expect(getResponseWindowDaysNumber(' 21 ')).toBe(21);
    expect(canSaveAssessmentDraft(draft)).toBe(true);

    draft.responseWindowDays = '';
    expect(canSaveAssessmentDraft(draft)).toBe(false);
  });

  it('serializes confirm-only drafts without fields or groups', () => {
    const draft = createInitialAssessmentEditorDraft(baseAssessment);
    draft.mode = 'confirm';
    draft.name = 'Confirm data';
    draft.assessmentTypeId = 'governance';

    expect(buildAssessmentFormData(draft)).toMatchObject({
      name: 'Confirm data',
      assessment_type_id: 'governance',
      mode: 'confirm',
      fields: [],
      groups: [],
      due_at: '2026-08-20',
      response_window_days: 14,
      recurrence: { type: 'weekly', intervalWeeks: 2 }
    });
  });
});
