import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

export const ASSESSMENT_TEMPLATE_ENUM_IDS = {
  sixRs: '00000000-0000-0000-0000-e00000000005',
  paceLayer: '00000000-0000-0000-0000-e00000000006'
} as const;

export type AssessmentTemplateValues = {
  name: string;
  description: string;
  mode: 'fields';
  scope: string[];
  scope_conditions: FilterCondition[];
  fields: AssessmentField[];
};

export type AssessmentTemplate = {
  id: string;
  label: string;
  description: string;
  values: AssessmentTemplateValues;
};

export const assessmentTemplates: AssessmentTemplate[] = [
  {
    id: 'business-technical-fit',
    label: 'Business fit vs. technical fit',
    description: 'Rate application portfolio fit from both business and technical perspectives.',
    values: {
      name: 'Application portfolio fitness',
      description:
        'Assess business fit and technical fit to support application portfolio decisions.',
      mode: 'fields',
      scope: [],
      scope_conditions: [],
      fields: [
        {
          id: 'business_fit',
          label: 'Business fit',
          type: 'rating',
          requirementLevel: 'required'
        },
        {
          id: 'technical_fit',
          label: 'Technical fit',
          type: 'rating',
          requirementLevel: 'required'
        }
      ]
    }
  },
  {
    id: 'six-rs',
    label: '6Rs migration strategy',
    description: 'Classify how each application should be moved, modernized, replaced, or retired.',
    values: {
      name: '6Rs migration strategy',
      description: 'Assess the preferred cloud migration strategy for each application.',
      mode: 'fields',
      scope: [],
      scope_conditions: [],
      fields: [
        {
          id: 'migration_strategy',
          label: 'Migration strategy',
          type: 'enum',
          enumId: ASSESSMENT_TEMPLATE_ENUM_IDS.sixRs,
          requirementLevel: 'required'
        }
      ]
    }
  },
  {
    id: 'pace-layering',
    label: 'Pace Layering',
    description: 'Classify applications by their rate of change and role in the business.',
    values: {
      name: 'Pace Layering',
      description:
        'Classify each application as a system of record, differentiation, or innovation.',
      mode: 'fields',
      scope: [],
      scope_conditions: [],
      fields: [
        {
          id: 'pace_layer',
          label: 'Pace layer',
          type: 'enum',
          enumId: ASSESSMENT_TEMPLATE_ENUM_IDS.paceLayer,
          requirementLevel: 'required'
        }
      ]
    }
  }
];

export const cloneAssessmentTemplateValues = (
  values: AssessmentTemplateValues
): AssessmentTemplateValues => ({
  ...values,
  scope: [...values.scope],
  scope_conditions: values.scope_conditions.map(condition => ({ ...condition })),
  fields: values.fields.map(field => ({ ...field }))
});
