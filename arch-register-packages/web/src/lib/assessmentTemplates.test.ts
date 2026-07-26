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
      {
        id: 'business_fit',
        label: 'Business fit',
        type: 'rating',
        max: 10,
        requirementLevel: 'required'
      },
      {
        id: 'technical_fit',
        label: 'Technical fit',
        type: 'rating',
        max: 10,
        requirementLevel: 'required'
      },
      {
        id: 'time_quadrant',
        label: 'TIME quadrant',
        type: 'derived',
        requirementLevel: 'optional',
        resultType: 'select',
        options: [
          { value: 'invest', label: 'Invest' },
          { value: 'migrate', label: 'Migrate' },
          { value: 'tolerate', label: 'Tolerate' },
          { value: 'eliminate', label: 'Eliminate' }
        ],
        expression:
          '(field("business_fit")>=6 && field("technical_fit")>=6 && "invest") || ' +
          '(field("business_fit")>=6 && field("technical_fit")<6 && "migrate") || ' +
          '(field("business_fit")<6 && field("technical_fit")>=6 && "tolerate") || ' +
          '"eliminate"'
      }
    ]);
  });

  it('computes the correct TIME quadrant for each business/technical fit combination', async () => {
    const { bonsai } = await import('bonsai-js');
    const template = assessmentTemplates.find(item => item.id === 'business-technical-fit')!;
    const quadrantField = template.values.fields.find(f => f.id === 'time_quadrant');
    if (quadrantField?.type !== 'derived') throw new Error('expected a derived field');

    const engine = bonsai<{ values: Record<string, unknown> }>({
      timeout: 50,
      maxDepth: 50
    }).addContextFunction('field', (ctx, id) => ctx.values[String(id)]);

    const cases: [number, number, string][] = [
      [8, 8, 'invest'],
      [6, 6, 'invest'],
      [8, 3, 'migrate'],
      [6, 5, 'migrate'],
      [3, 8, 'tolerate'],
      [5, 6, 'tolerate'],
      [3, 3, 'eliminate'],
      [5, 5, 'eliminate']
    ];

    for (const [business_fit, technical_fit, expected] of cases) {
      expect(
        engine.evaluateSync(quadrantField.expression, { values: { business_fit, technical_fit } })
      ).toBe(expected);
    }
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
