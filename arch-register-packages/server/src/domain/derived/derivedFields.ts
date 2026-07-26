import { bonsai, type ASTNode, type CompiledExpression } from 'bonsai-js';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { createLogger } from '../../utils/logger';
import { httpAssert } from '../../utils/httpAssert';

export type DerivedFieldDefinition = {
  id: string;
  expression: string;
  resultType: 'text' | 'number' | 'select' | 'boolean' | 'rating';
};

type DerivedPlan = {
  fields: DerivedFieldDefinition[];
  compiled: Map<string, CompiledExpression>;
  dependencies: Map<string, string[]>;
};

type EvaluationContext = { values: Record<string, unknown> };

const logger = createLogger('derived-fields');

const engine = bonsai<EvaluationContext>({ timeout: 50, maxDepth: 50 }).addContextFunction(
  'field',
  (context, fieldId) => context.values[String(fieldId)]
);

const derivedField = (field: SchemaField | AssessmentField): DerivedFieldDefinition | null =>
  field.type === 'derived'
    ? {
        id: field.id,
        expression: field.expression,
        resultType: field.resultType
      }
    : null;

const collectDependencies = (node: ASTNode, dependencies: string[]) => {
  if (node.type === 'CallExpression') {
    if (node.callee.type === 'Identifier' && node.callee.name === 'field') {
      const argument = node.args[0];
      if (node.args.length !== 1 || argument?.type !== 'StringLiteral') {
        throw new Error('field() requires exactly one string literal field id');
      }
      dependencies.push(argument.value);
    }
    collectDependencies(node.callee, dependencies);
    node.args.forEach(argument => collectDependencies(argument, dependencies));
    return;
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object' && 'type' in value) {
      collectDependencies(value as ASTNode, dependencies);
    }
  }
};

export const buildDerivedPlan = (fields: Array<SchemaField | AssessmentField>): DerivedPlan => {
  const allFieldIds = new Set(fields.map(field => field.id));
  const definitions = fields.flatMap(field => {
    const definition = derivedField(field);
    return definition ? [definition] : [];
  });
  const derivedIds = new Set(definitions.map(field => field.id));
  const compiled = new Map<string, CompiledExpression>();
  const dependencies = new Map<string, string[]>();

  for (const definition of definitions) {
    const validation = engine.validate(definition.expression);
    if (!validation.valid) {
      throw new Error(
        `Invalid expression for derived field '${definition.id}': ${validation.errors
          .map(error => error.formatted ?? error.message)
          .join('; ')}`
      );
    }
    if (validation.references.identifiers.length > 0) {
      throw new Error(
        `Derived field '${definition.id}' may only reference sibling fields with field() — found ${validation.references.identifiers.join(', ')}`
      );
    }

    const fieldDependencies: string[] = [];
    collectDependencies(validation.ast, fieldDependencies);
    const uniqueDependencies = [...new Set(fieldDependencies)];
    for (const dependency of uniqueDependencies) {
      if (!allFieldIds.has(dependency)) {
        throw new Error(
          `Derived field '${definition.id}' references unknown sibling field '${dependency}'`
        );
      }
    }
    dependencies.set(
      definition.id,
      uniqueDependencies.filter(id => derivedIds.has(id))
    );
    compiled.set(definition.id, engine.compile(definition.expression));
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: DerivedFieldDefinition[] = [];
  const byId = new Map(definitions.map(field => [field.id, field]));
  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cyclic derived field dependency involving '${id}'`);
    visiting.add(id);
    dependencies.get(id)?.forEach(visit);
    visiting.delete(id);
    visited.add(id);
    ordered.push(byId.get(id)!);
  };
  definitions.forEach(field => visit(field.id));

  return { fields: ordered, compiled, dependencies };
};

const isMissing = (value: unknown) => value === undefined || value === null || value === '';

const coerceResult = (field: DerivedFieldDefinition, value: unknown): unknown => {
  if (isMissing(value)) return undefined;
  switch (field.resultType) {
    case 'text':
      if (typeof value !== 'string') throw new Error(`Expected text, received ${typeof value}`);
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error('Expected an integer number');
      }
      return value;
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error(`Expected boolean, received ${typeof value}`);
      return value;
    case 'rating':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error('Expected a rating integer from 1 to 5');
      }
      return value;
    case 'select':
      if (typeof value !== 'string')
        throw new Error(`Expected select text, received ${typeof value}`);
      return value;
  }
};

export const evaluateDerivedFields = (
  plan: DerivedPlan,
  inputValues: Record<string, unknown>,
  context: { objectType: 'entity' | 'assessment'; objectId: string }
): Record<string, unknown> => {
  const values = { ...inputValues };
  for (const field of plan.fields) {
    const dependencies = plan.dependencies.get(field.id) ?? [];
    if (dependencies.some(dependency => isMissing(values[dependency]))) {
      delete values[field.id];
      continue;
    }
    try {
      const result = plan.compiled.get(field.id)!.evaluateSync({ values });
      const coerced = coerceResult(field, result);
      if (coerced === undefined) delete values[field.id];
      else values[field.id] = coerced;
    } catch (error) {
      delete values[field.id];
      logger.error(`Failed to evaluate ${context.objectType} derived field`, {
        ...context,
        fieldId: field.id,
        expression: field.expression,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return values;
};

export const materializeDerivedFields = (
  fields: Array<SchemaField | AssessmentField>,
  values: Record<string, unknown>,
  context: { objectType: 'entity' | 'assessment'; objectId: string }
) => {
  const plan = buildDerivedPlan(fields);
  return evaluateDerivedFields(plan, values, context);
};

export const assertNoDerivedFieldWrites = (
  fields: Array<SchemaField | AssessmentField>,
  values: Record<string, unknown>
) => {
  const derivedIds = new Set(
    fields.filter(field => field.type === 'derived').map(field => field.id)
  );
  const attempted = Object.keys(values).filter(id => derivedIds.has(id));
  if (attempted.length > 0) {
    httpAssert.true(false, {
      status: 400,
      message: `Derived fields are read-only: ${attempted.join(', ')}`
    });
  }
};

export const isDerivedField = (field: SchemaField | AssessmentField) => field.type === 'derived';
