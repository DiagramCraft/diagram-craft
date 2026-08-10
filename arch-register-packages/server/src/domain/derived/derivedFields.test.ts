import { describe, expect, it } from 'vitest';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { SchemaField, SchemaGroup } from '@arch-register/api-types/schemaContract';
import {
  buildDerivedPlan,
  evaluateDerivedFields,
  materializeDerivedFields,
  validateDerivedFieldGroupAccess
} from './derivedFields';

const field = (id: string, type: AssessmentField['type'] = 'text'): AssessmentField => {
  if (type === 'derived') {
    return {
      id,
      label: id,
      type,
      requirementLevel: 'optional',
      expression: 'field("input")',
      resultType: 'text'
    };
  }
  return { id, label: id, type, requirementLevel: 'optional' } as AssessmentField;
};

const context = { objectType: 'assessment' as const, objectId: 'assessment-1' };
const entityContext = { objectType: 'entity' as const, objectId: 'entity-1' };

const schemaText = (id: string, groupId?: string): SchemaField => ({
  id,
  name: id,
  type: 'text',
  ...(groupId ? { groupId } : {})
});

const derivedSchemaText = (id: string, expression: string, groupId?: string): SchemaField => ({
  id,
  name: id,
  type: 'derived',
  requirementLevel: 'optional',
  expression,
  resultType: 'text',
  ...(groupId ? { groupId } : {})
});

describe('derived fields', () => {
  it('evaluates sibling references in dependency order and materializes typed values', () => {
    const fields: AssessmentField[] = [
      field('input'),
      {
        id: 'amount',
        label: 'Amount',
        type: 'derived',
        requirementLevel: 'optional',
        expression: 'field("input") + 2',
        resultType: 'number'
      },
      {
        id: 'summary',
        label: 'Summary',
        type: 'derived',
        requirementLevel: 'optional',
        expression: 'field("amount") + 3',
        resultType: 'number'
      }
    ];

    expect(materializeDerivedFields(fields, { input: 5 }, context)).toEqual({
      input: 5,
      amount: 7,
      summary: 10
    });
  });

  it('evaluates one-hop dependent aggregates and currency results', () => {
    const fields: SchemaField[] = [
      {
        id: 'annual_cost',
        name: 'Annual cost',
        type: 'currency'
      },
      {
        id: 'total_cost',
        name: 'Total cost',
        type: 'derived',
        requirementLevel: 'optional',
        expression:
          "{ amount: dependents.map(.values['annual_cost'].amount) |> sum, currency: 'USD' }",
        resultType: 'currency'
      }
    ];
    const graph = {
      entity: { id: 'system-1', schemaId: 'system', values: {} },
      dependents: [
        {
          id: 'contract-1',
          schemaId: 'contract',
          values: { annual_cost: { amount: 1200, currency: 'USD' } }
        },
        {
          id: 'contract-2',
          schemaId: 'contract',
          values: { annual_cost: { amount: 800, currency: 'USD' } }
        }
      ]
    };

    expect(materializeDerivedFields(fields, {}, entityContext, [], graph)).toEqual({
      total_cost: { amount: 2000, currency: 'USD' }
    });
  });

  it('rejects unsupported graph identifiers while allowing entity and dependents', () => {
    expect(() =>
      buildDerivedPlan([
        derivedSchemaText('total', 'dependents.map(.values.amount) |> sum'),
        derivedSchemaText('invalid', 'workspace.secret')
      ])
    ).toThrow(/workspace/);
  });

  it('omits derived values when an input is missing or the result has the wrong type', () => {
    const fields: AssessmentField[] = [
      field('input'),
      {
        id: 'derived',
        label: 'Derived',
        type: 'derived',
        requirementLevel: 'optional',
        expression: 'field("input")',
        resultType: 'number'
      }
    ];
    const plan = buildDerivedPlan(fields);

    expect(evaluateDerivedFields(plan, { input: '' }, context)).toEqual({ input: '' });
    expect(evaluateDerivedFields(plan, { input: 'not a number' }, context)).toEqual({
      input: 'not a number'
    });
  });

  it('rejects unknown references and cycles', () => {
    expect(() =>
      buildDerivedPlan([
        field('input'),
        {
          id: 'derived',
          label: 'Derived',
          type: 'derived',
          requirementLevel: 'optional',
          expression: 'field("missing")',
          resultType: 'text'
        }
      ])
    ).toThrow(/unknown sibling field/);

    const cyclic = [
      {
        id: 'first',
        label: 'First',
        type: 'derived' as const,
        requirementLevel: 'optional' as const,
        expression: 'field("second")',
        resultType: 'text' as const
      },
      {
        id: 'second',
        label: 'Second',
        type: 'derived' as const,
        requirementLevel: 'optional' as const,
        expression: 'field("first")',
        resultType: 'text' as const
      }
    ];
    expect(() => buildDerivedPlan(cyclic)).toThrow(/Cyclic derived field dependency/);
  });

  it('rejects an unrestricted derived field that references a restricted field', () => {
    expect(() =>
      validateDerivedFieldGroupAccess(
        [schemaText('salary', 'hr'), derivedSchemaText('salary_copy', 'field("salary")')],
        [{ id: 'hr', name: 'HR', accessControl: { teamIds: ['team-hr'] } }]
      )
    ).toThrow(/salary_copy.*salary/);
  });

  it('rejects a derived field that references a field with an unresolved group', () => {
    expect(() =>
      validateDerivedFieldGroupAccess(
        [schemaText('salary', 'missing'), derivedSchemaText('salary_copy', 'field("salary")')],
        []
      )
    ).toThrow(/salary_copy.*salary.*unresolved field group.*missing/);
  });

  it('removes legacy derived values with unresolved direct and transitive dependencies', () => {
    const fields = [
      schemaText('salary', 'missing'),
      derivedSchemaText('salary_copy', 'field("salary")'),
      derivedSchemaText('salary_label', 'field("salary_copy")')
    ];

    expect(
      materializeDerivedFields(
        fields,
        { salary: 'secret', salary_copy: 'secret', salary_label: 'secret' },
        entityContext,
        []
      )
    ).toEqual({ salary: 'secret' });
  });

  it('removes a derived value whose own group is unresolved', () => {
    expect(
      materializeDerivedFields(
        [schemaText('input'), derivedSchemaText('output', 'field("input")', 'missing')],
        { input: 'value', output: 'stale' },
        entityContext,
        []
      )
    ).toEqual({ input: 'value' });
  });

  it('allows a derived field in an equally or more restrictive group', () => {
    const fields = [
      schemaText('salary', 'hr'),
      derivedSchemaText('salary_copy', 'field("salary")', 'hr-only')
    ];
    const groups: SchemaGroup[] = [
      { id: 'hr', name: 'HR', accessControl: { teamIds: ['team-hr', 'team-payroll'] } },
      { id: 'hr-only', name: 'HR only', accessControl: { teamIds: ['team-hr'] } }
    ];

    expect(() => validateDerivedFieldGroupAccess(fields, groups)).not.toThrow();
  });

  it('rejects a derived group that is broader than any restricted dependency', () => {
    expect(() =>
      validateDerivedFieldGroupAccess(
        [
          schemaText('salary', 'hr'),
          schemaText('bonus', 'payroll'),
          derivedSchemaText('compensation', 'field("salary") + field("bonus")', 'combined')
        ],
        [
          { id: 'hr', name: 'HR', accessControl: { teamIds: ['team-hr'] } },
          { id: 'payroll', name: 'Payroll', accessControl: { teamIds: ['team-payroll'] } },
          {
            id: 'combined',
            name: 'Combined',
            accessControl: { teamIds: ['team-hr', 'team-payroll'] }
          }
        ]
      )
    ).toThrow(/compensation.*salary/);
  });

  it('applies the restriction transitively through derived dependencies', () => {
    expect(() =>
      validateDerivedFieldGroupAccess(
        [
          schemaText('salary', 'hr'),
          derivedSchemaText('salary_copy', 'field("salary")', 'hr'),
          derivedSchemaText('salary_label', 'field("salary_copy")')
        ],
        [{ id: 'hr', name: 'HR', accessControl: { teamIds: ['team-hr'] } }]
      )
    ).toThrow(/salary_label.*salary/);
  });
});
