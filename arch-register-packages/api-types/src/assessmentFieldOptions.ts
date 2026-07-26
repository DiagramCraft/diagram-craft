import type { AssessmentEnumOption, AssessmentField } from './assessmentContract';

export const getInlineAssessmentEnumOptions = (
  field: AssessmentField
): AssessmentEnumOption[] | undefined =>
  field.type === 'enum' || (field.type === 'derived' && field.resultType === 'select')
    ? 'options' in field
      ? field.options
      : undefined
    : undefined;

export const getAssessmentEnumOptions = <T extends { id: string; options: AssessmentEnumOption[] }>(
  field: AssessmentField,
  enums: T[]
): AssessmentEnumOption[] => {
  if (field.type !== 'enum' && (field.type !== 'derived' || field.resultType !== 'select'))
    return [];
  return (
    getInlineAssessmentEnumOptions(field) ??
    ('enumId' in field
      ? enums.find(enumeration => enumeration.id === field.enumId)?.options
      : undefined) ??
    []
  );
};
