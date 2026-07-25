import { describe, expect, it } from 'vitest';
import type { AssessmentEnumField } from './assessmentContract';
import { getAssessmentEnumOptions } from './assessmentFieldOptions';

const workspaceEnums = [{ id: 'workspace-enum', options: [{ value: 'a', label: 'Workspace A' }] }];

describe('getAssessmentEnumOptions', () => {
  it('prefers assessment-local options', () => {
    const field: AssessmentEnumField = {
      id: 'field-1',
      label: 'Local choice',
      type: 'enum',
      requirementLevel: 'required',
      options: [{ value: 'local', label: 'Local option' }]
    };

    expect(getAssessmentEnumOptions(field, workspaceEnums)).toEqual([
      { value: 'local', label: 'Local option' }
    ]);
  });

  it('resolves workspace-backed options for legacy fields', () => {
    const field: AssessmentEnumField = {
      id: 'field-1',
      label: 'Workspace choice',
      type: 'enum',
      requirementLevel: 'required',
      enumId: 'workspace-enum'
    };

    expect(getAssessmentEnumOptions(field, workspaceEnums)).toEqual([
      { value: 'a', label: 'Workspace A' }
    ]);
  });
});
