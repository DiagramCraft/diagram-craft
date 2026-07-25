import type { AssessmentEnumField, AssessmentEnumOption } from './assessmentContract';

export const getInlineAssessmentEnumOptions = (
  field: AssessmentEnumField
): AssessmentEnumOption[] | undefined => ('options' in field ? field.options : undefined);

export const getAssessmentEnumOptions = <T extends { id: string; options: AssessmentEnumOption[] }>(
  field: AssessmentEnumField,
  enums: T[]
): AssessmentEnumOption[] =>
  getInlineAssessmentEnumOptions(field) ??
  ('enumId' in field
    ? enums.find(enumeration => enumeration.id === field.enumId)?.options
    : undefined) ??
  [];
