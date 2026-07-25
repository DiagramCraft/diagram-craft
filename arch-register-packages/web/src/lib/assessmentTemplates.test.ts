import { describe, expect, it } from 'vitest';
import { assessmentTemplates, cloneAssessmentTemplateValues } from './assessmentTemplates';

describe('assessment templates', () => {
  it('provides the business and technical fit starter fields', () => {
    const template = assessmentTemplates.find(item => item.id === 'business-technical-fit');

    expect(template).toMatchObject({
      label: 'Business fit vs. technical fit',
      values: {
        name: 'Application portfolio fitness',
        mode: 'fields',
        scope: []
      }
    });
    expect(template?.values.fields).toEqual([
      { id: 'business_fit', label: 'Business fit', type: 'rating', requirementLevel: 'required' },
      {
        id: 'technical_fit',
        label: 'Technical fit',
        type: 'rating',
        requirementLevel: 'required'
      }
    ]);
  });

  it('clones template values before applying them', () => {
    const template = assessmentTemplates[0]!;
    const values = cloneAssessmentTemplateValues(template.values);

    values.fields[0]!.label = 'Changed';
    values.scope.push('schema-1');

    expect(template.values.fields[0]!.label).toBe('Business fit');
    expect(template.values.scope).toEqual([]);
  });

  it('provides enum-based 6Rs and Pace Layering templates', () => {
    const sixRs = assessmentTemplates.find(template => template.id === 'six-rs');
    const paceLayering = assessmentTemplates.find(template => template.id === 'pace-layering');

    expect(sixRs?.values.fields[0]).toMatchObject({
      id: 'migration_strategy',
      type: 'enum',
      options: [
        { value: 'rehost', label: 'Rehost (Lift and Shift)' },
        { value: 'replatform', label: 'Replatform (Lift, Tinker, and Shift)' },
        { value: 'refactor', label: 'Refactor / Rearchitect' },
        { value: 'repurchase', label: 'Repurchase (Drop and Shop)' },
        { value: 'retire', label: 'Retire' },
        { value: 'retain', label: 'Retain (Revisit Later)' }
      ]
    });
    expect(paceLayering?.values.fields[0]).toMatchObject({
      id: 'pace_layer',
      type: 'enum',
      options: [
        { value: 'record', label: 'Systems of Record' },
        { value: 'differentiation', label: 'Systems of Differentiation' },
        { value: 'innovation', label: 'Systems of Innovation' }
      ]
    });
  });
});
