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

    expect(sixRs?.values.fields).toEqual([
      expect.objectContaining({ id: 'migration_strategy', type: 'enum' })
    ]);
    expect(paceLayering?.values.fields).toEqual([
      expect.objectContaining({ id: 'pace_layer', type: 'enum' })
    ]);
  });
});
