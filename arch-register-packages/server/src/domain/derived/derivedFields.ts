import { bonsai, type ASTNode, type CompiledExpression } from 'bonsai-js';
import { arrays, math, strings, types } from 'bonsai-js/stdlib';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import {
  isRelationLikeField,
  type SchemaField,
  type SchemaGroup
} from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import { currencyValueSchema } from '@arch-register/api-types/common';
import { createLogger } from '../../utils/logger';
import { httpAssert } from '../../utils/httpAssert';

export type DerivedFieldDefinition = {
  id: string;
  expression: string;
  resultType: 'text' | 'number' | 'currency' | 'select' | 'boolean' | 'rating';
};

export type DerivedEntityContext = Record<string, unknown>;
export type DerivedRoot = 'entity' | 'assessment' | 'relation';

/** Any field shape that can carry a `type: 'derived'` variant. */
export type DerivableField = SchemaField | AssessmentField | RelationField;

/** Minimal field-group shape the group-access checks need — entity or relation schema groups. */
export type DerivedFieldGroup = {
  id: string;
  name?: string;
  accessControl?: { teamIds: string[] } | undefined;
};

/**
 * Pseudo-field names a relation-rooted derived expression may read in addition to the schema's
 * declared fields: `relation._in` / `relation._out` are the projected endpoint entities. The
 * underscore prefix keeps them out of the field-id namespace and avoids the `in` reserved word.
 */
export const RELATION_ROOT_PSEUDO_FIELDS = new Set(['_in', '_out']);

type DerivedPlan = {
  fields: DerivedFieldDefinition[];
  compiled: Map<string, CompiledExpression>;
  dependencies: Map<string, string[]>;
  references: Map<string, string[]>;
  root: DerivedRoot;
};

type EvaluationContext = {
  entity?: DerivedEntityContext;
  assessment?: DerivedEntityContext;
  relation?: DerivedEntityContext;
};

type GroupAccessBoundary =
  | { kind: 'unrestricted' }
  | { kind: 'restricted'; teamIds: Set<string> }
  | { kind: 'unresolved'; groupId: string };

const logger = createLogger('derived-fields');

const engine = bonsai<EvaluationContext>({ timeout: 50, maxDepth: 50 })
  .use(arrays)
  .use(math)
  .use(strings)
  .use(types);

const derivedField = (field: DerivableField): DerivedFieldDefinition | null =>
  field.type === 'derived'
    ? {
        id: field.id,
        expression: field.expression,
        resultType: field.resultType
      }
    : null;

const collectRootDependencies = (node: ASTNode, root: DerivedRoot, dependencies: string[]) => {
  const member = node as unknown as {
    type: string;
    object?: { type?: string; name?: string };
    property?: { type?: string; name?: string; value?: string };
    computed?: boolean;
  };
  if (
    member.type === 'MemberExpression' &&
    member.object?.type === 'Identifier' &&
    member.object.name === root
  ) {
    const property = member.computed ? member.property?.value : member.property?.name;
    if (typeof property === 'string' && property !== 'metadata') dependencies.push(property);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object' && 'type' in item) {
          collectRootDependencies(item as ASTNode, root, dependencies);
        }
      });
    } else if (value && typeof value === 'object' && 'type' in value) {
      collectRootDependencies(value as ASTNode, root, dependencies);
    }
  }
};

const collectObjectLiteralKeys = (node: ASTNode, keys: Set<string>) => {
  const objectProperty = node as unknown as {
    type: string;
    computed?: boolean;
    key?: { type: string; name?: string };
  };
  if (
    objectProperty.type === 'ObjectProperty' &&
    !objectProperty.computed &&
    objectProperty.key?.type === 'Identifier' &&
    objectProperty.key.name
  ) {
    keys.add(objectProperty.key.name);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object' && 'type' in item) {
          collectObjectLiteralKeys(item as ASTNode, keys);
        }
      });
    } else if (value && typeof value === 'object' && 'type' in value) {
      collectObjectLiteralKeys(value as ASTNode, keys);
    }
  }
};

const inferRoot = (fields: DerivableField[]): DerivedRoot =>
  fields.some(field => 'name' in field) ? 'entity' : 'assessment';

export const buildDerivedPlan = (
  fields: DerivableField[],
  root: DerivedRoot = inferRoot(fields)
): DerivedPlan => {
  const allFieldIds = new Set(fields.map(field => field.id));
  const isKnownDependency = (dependency: string) =>
    allFieldIds.has(dependency) ||
    (root === 'relation' && RELATION_ROOT_PSEUDO_FIELDS.has(dependency));
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
    const objectLiteralKeys = new Set<string>();
    collectObjectLiteralKeys(validation.ast, objectLiteralKeys);
    const unsupportedIdentifiers = validation.references.identifiers.filter(
      identifier => identifier !== root && !objectLiteralKeys.has(identifier)
    );
    if (unsupportedIdentifiers.length > 0) {
      throw new Error(
        `Derived field '${definition.id}' may only reference fields through ${root} — found ${unsupportedIdentifiers.join(', ')}`
      );
    }

    const fieldDependencies: string[] = [];
    collectRootDependencies(validation.ast, root, fieldDependencies);
    const uniqueDependencies = [...new Set(fieldDependencies)];
    for (const dependency of uniqueDependencies) {
      if (!isKnownDependency(dependency)) {
        throw new Error(
          `Derived field '${definition.id}' references unknown ${root} field '${dependency}'`
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

  return { fields: ordered, compiled, dependencies, references, root };
};

const groupAccessBoundary = (
  field: { groupId?: string },
  groups: ReadonlyArray<Pick<SchemaGroup, 'id' | 'accessControl'>>
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
  fieldById: Map<string, DerivableField>
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
  fields: DerivableField[],
  groups: ReadonlyArray<DerivedFieldGroup> = [],
  root: DerivedRoot = 'entity'
): Set<string> => {
  const plan = buildDerivedPlan(fields, root);
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
  fields: DerivableField[],
  groups: ReadonlyArray<DerivedFieldGroup> = [],
  root: DerivedRoot = 'entity'
) => {
  const plan = buildDerivedPlan(fields, root);
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
    case 'currency': {
      const parsed = currencyValueSchema.safeParse(value);
      if (!parsed.success) throw new Error('Expected a finite amount and three-letter currency');
      return parsed.data;
    }
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
  context: { objectType: DerivedRoot; objectId: string },
  unsafeDerivedFieldIds: ReadonlySet<string> = new Set(),
  entityContext: DerivedEntityContext = inputValues
): Record<string, unknown> => {
  const values = { ...inputValues };
  const rootContext = { ...entityContext };
  const evaluationContext: EvaluationContext =
    plan.root === 'entity'
      ? { entity: rootContext }
      : plan.root === 'relation'
        ? { relation: rootContext }
        : { assessment: rootContext };
  for (const field of plan.fields) {
    if (unsafeDerivedFieldIds.has(field.id)) {
      delete values[field.id];
      delete rootContext[field.id];
      continue;
    }
    const dependencies = plan.dependencies.get(field.id) ?? [];
    if (dependencies.some(dependency => isMissing(values[dependency]))) {
      delete values[field.id];
      delete rootContext[field.id];
      continue;
    }
    try {
      const result = plan.compiled.get(field.id)!.evaluateSync(evaluationContext);
      const coerced = coerceResult(field, result);
      if (coerced === undefined) {
        delete values[field.id];
        delete rootContext[field.id];
      } else {
        values[field.id] = coerced;
        rootContext[field.id] = coerced;
      }
    } catch (error) {
      delete values[field.id];
      delete rootContext[field.id];
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
  fields: DerivableField[],
  values: Record<string, unknown>,
  context: { objectType: DerivedRoot; objectId: string },
  groups?: ReadonlyArray<DerivedFieldGroup>,
  entityContext?: DerivedEntityContext
) => {
  const plan = buildDerivedPlan(fields, context.objectType);
  const unsafeDerivedFieldIds = groups
    ? getDerivedFieldIdsWithUnresolvedGroups(fields, groups, context.objectType)
    : new Set<string>();
  const relationFieldIds =
    context.objectType === 'relation'
      ? new Set<string>([
          ...fields.filter(field => field.type === 'entityRelation').map(field => field.id),
          ...RELATION_ROOT_PSEUDO_FIELDS
        ])
      : new Set(
          fields
            .filter(field => 'name' in field && isRelationLikeField(field as SchemaField))
            .map(field => field.id)
        );
  const relationDependentDerivedFieldIds =
    entityContext === undefined
      ? new Set(
          plan.fields
            .filter(field => plan.references.get(field.id)?.some(id => relationFieldIds.has(id)))
            .map(field => field.id)
        )
      : new Set<string>();
  const deferredDerivedFieldIds = new Set([
    ...unsafeDerivedFieldIds,
    ...relationDependentDerivedFieldIds
  ]);
  return evaluateDerivedFields(
    plan,
    values,
    context,
    deferredDerivedFieldIds,
    entityContext ?? values
  );
};

export const assertNoDerivedFieldWrites = (
  fields: DerivableField[],
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
