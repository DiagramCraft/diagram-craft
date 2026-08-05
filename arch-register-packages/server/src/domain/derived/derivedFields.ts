import { bonsai, type ASTNode, type CompiledExpression } from 'bonsai-js';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { SchemaField, SchemaGroup } from '@arch-register/api-types/schemaContract';
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
  references: Map<string, string[]>;
};

type EvaluationContext = { values: Record<string, unknown> };

type GroupAccessBoundary =
  | { kind: 'unrestricted' }
  | { kind: 'restricted'; teamIds: Set<string> }
  | { kind: 'unresolved'; groupId: string };

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
  const references = new Map<string, string[]>();

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
    references.set(definition.id, uniqueDependencies);
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

  return { fields: ordered, compiled, dependencies, references };
};

const groupAccessBoundary = (
  field: { groupId?: string },
  groups: SchemaGroup[]
): GroupAccessBoundary => {
  if (field.groupId == null) return { kind: 'unrestricted' };
  const group = groups.find(candidate => candidate.id === field.groupId);
  if (!group) return { kind: 'unresolved', groupId: field.groupId };
  const teamIds = group?.accessControl?.teamIds;
  return teamIds && teamIds.length > 0
    ? { kind: 'restricted', teamIds: new Set(teamIds) }
    : { kind: 'unrestricted' };
};

const collectTransitiveDependencies = (
  plan: DerivedPlan,
  fieldById: Map<string, SchemaField | AssessmentField>
) => {
  const dependenciesByDerivedId = new Map<string, Set<string>>();

  const collect = (fieldId: string, visiting: Set<string>): Set<string> => {
    const cached = dependenciesByDerivedId.get(fieldId);
    if (cached) return cached;
    if (visiting.has(fieldId)) return new Set();

    visiting.add(fieldId);
    const result = new Set<string>();
    for (const dependency of plan.references.get(fieldId) ?? []) {
      result.add(dependency);
      if (fieldById.get(dependency)?.type === 'derived') {
        collect(dependency, visiting).forEach(id => result.add(id));
      }
    }
    visiting.delete(fieldId);
    dependenciesByDerivedId.set(fieldId, result);
    return result;
  };

  for (const field of plan.fields) collect(field.id, new Set());
  return dependenciesByDerivedId;
};

/**
 * Finds derived fields whose own group or any transitive dependency group cannot be resolved.
 * These values must not be materialized or returned through an authenticated redaction path.
 */
export const getDerivedFieldIdsWithUnresolvedGroups = (
  fields: Array<SchemaField | AssessmentField>,
  groups: SchemaGroup[] = []
): Set<string> => {
  const plan = buildDerivedPlan(fields);
  const fieldById = new Map(fields.map(field => [field.id, field]));
  const dependenciesByDerivedId = collectTransitiveDependencies(plan, fieldById);
  const unresolved = new Set<string>();

  for (const derived of plan.fields) {
    const outputBoundary = groupAccessBoundary(fieldById.get(derived.id)!, groups);
    if (outputBoundary.kind === 'unresolved') {
      unresolved.add(derived.id);
      continue;
    }

    for (const dependencyId of dependenciesByDerivedId.get(derived.id) ?? []) {
      const dependency = fieldById.get(dependencyId);
      if (!dependency) continue;
      if (groupAccessBoundary(dependency, groups).kind === 'unresolved') {
        unresolved.add(derived.id);
        break;
      }
    }
  }

  return unresolved;
};

/**
 * Ensures a derived field cannot be visible to a broader audience than any value it reads.
 * This is intentionally based on the persisted team-set boundary rather than the current caller
 * because derived values are stored once and subsequently returned to many callers. An unresolved
 * group is rejected rather than treated as an unrestricted field/group.
 */
export const validateDerivedFieldGroupAccess = (
  fields: SchemaField[],
  groups: SchemaGroup[] = []
) => {
  const plan = buildDerivedPlan(fields);
  const fieldById = new Map(fields.map(field => [field.id, field]));
  const dependenciesByDerivedId = collectTransitiveDependencies(plan, fieldById);

  for (const derived of plan.fields) {
    const outputBoundary = groupAccessBoundary(fieldById.get(derived.id)!, groups);
    if (outputBoundary.kind === 'unresolved') {
      httpAssert.true(false, {
        status: 400,
        message: `Derived field '${derived.id}' references unresolved field group '${outputBoundary.groupId}'`
      });
    }

    for (const dependencyId of dependenciesByDerivedId.get(derived.id) ?? []) {
      const dependency = fieldById.get(dependencyId);
      if (!dependency) continue;
      const dependencyBoundary = groupAccessBoundary(dependency, groups);
      if (dependencyBoundary.kind === 'unresolved') {
        httpAssert.true(false, {
          status: 400,
          message: `Derived field '${derived.id}' references field '${dependency.id}' with unresolved field group '${dependencyBoundary.groupId}'`
        });
        continue;
      }
      if (dependencyBoundary.kind === 'unrestricted') continue;

      const outputIsNarrowEnough =
        outputBoundary.kind === 'restricted' &&
        [...outputBoundary.teamIds].every(teamId => dependencyBoundary.teamIds.has(teamId));
      httpAssert.true(outputIsNarrowEnough, {
        status: 400,
        message: `Derived field '${derived.id}' cannot reference restricted field '${dependency.id}' from a broader field group`
      });
    }
  }
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
  context: { objectType: 'entity' | 'assessment'; objectId: string },
  unsafeDerivedFieldIds: ReadonlySet<string> = new Set()
): Record<string, unknown> => {
  const values = { ...inputValues };
  for (const field of plan.fields) {
    if (unsafeDerivedFieldIds.has(field.id)) {
      delete values[field.id];
      continue;
    }
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
  context: { objectType: 'entity' | 'assessment'; objectId: string },
  groups?: SchemaGroup[]
) => {
  const plan = buildDerivedPlan(fields);
  const unsafeDerivedFieldIds = groups
    ? getDerivedFieldIdsWithUnresolvedGroups(fields, groups)
    : new Set<string>();
  return evaluateDerivedFields(plan, values, context, unsafeDerivedFieldIds);
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
