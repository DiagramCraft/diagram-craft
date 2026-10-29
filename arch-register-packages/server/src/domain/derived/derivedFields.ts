import { bonsai, fn, forEachChild, t, type Node, type Program } from 'bonsai-js';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import {
  isRelationLikeField,
  type SchemaField,
  type SchemaGroup
} from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import { currencyValueSchema } from '@arch-register/api-types/common';
import { createLogger } from '../../utils/logger';
import { parseDurationValue } from '../../utils/durationValue';
import { httpAssert } from '../../utils/httpAssert';

export type DerivedRecalcInterval = 'hourly' | 'daily';

export type DerivedFieldDefinition = {
  id: string;
  expression: string;
  resultType: 'text' | 'number' | 'currency' | 'select' | 'boolean' | 'rating' | 'duration';
  /**
   * Cadence at which the recurring `derived-fields.recalculate-scan` job recomputes this value.
   * Only meaningful for expressions that read `<root>.now`; `buildDerivedPlan` defaults such a
   * field to `'daily'` and rejects the flag on a field that does not reference `now`.
   */
  recalcInterval?: DerivedRecalcInterval;
};

/** ISO `YYYY-MM-DD` in UTC — matches how `date`-typed fields are stored and projected. */
const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

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

/** Exchange rates injected as `<root>.fx` so a derived expression can convert currency values to
 *  the workspace currency (see the `sumCurrency` helper). `rates` are relative to one base. */
export type DerivedCurrencyConversion = { targetCurrency: string; rates: Record<string, number> };

type DerivedPlan = {
  fields: DerivedFieldDefinition[];
  compiled: Map<string, Program>;
  dependencies: Map<string, string[]>;
  references: Map<string, string[]>;
  root: DerivedRoot;
  /** Ids of derived fields whose expression reads `<root>.now` (kept fresh by the scan job). */
  timeDependentFieldIds: Set<string>;
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

const engine = bonsai({
  strict: false,
  limits: {
    timeout: 50,
    maxDepth: 50,
    maxValueDepth: 50,
    maxListLength: 100_000,
    maxStringLength: 100_000,
    maxSteps: 1_000_000
  },
  functions: {
    product: fn({
      params: [t.list(t.number())],
      returns: t.number(),
      run: values => values.reduce((product, item) => product * item, 1)
    }),
    // Signed whole-day difference between two ISO date strings; null when either is unparseable.
    daysBetween: fn({
      params: [t.any(), t.any()],
      returns: t.optional(t.number()),
      run: (from, to) => {
        const a = Date.parse(String(from));
        const b = Date.parse(String(to));
        return Number.isNaN(a) || Number.isNaN(b)
          ? null
          : Math.round((b - a) / 86_400_000);
      }
    }),
    // Earliest ISO date in `dates` on or after `from`; invalid entries are ignored.
    earliestOnOrAfter: fn({
      params: [t.list(t.any()), t.any()],
      returns: t.optional(t.string()),
      run: (dates, from) => {
        const floor = Date.parse(String(from));
        if (Number.isNaN(floor)) return null;
        const upcoming = dates
          .filter((date): date is string => typeof date === 'string' && Date.parse(date) >= floor)
          .sort();
        return upcoming[0] ?? null;
      }
    }),
    // Total currency values, converting through `fx` when it is available.
    sumCurrency: fn({
      params: [t.list(t.any()), t.any()],
      required: 1,
      returns: t.optional(t.object({ amount: t.number(), currency: t.string() })),
      run: (values, fx) => {
        const valid = values.filter(
          (value): value is { amount: number; currency: string } =>
            value != null &&
            typeof value === 'object' &&
            Number.isFinite((value as { amount?: unknown }).amount) &&
            typeof (value as { currency?: unknown }).currency === 'string'
        );
        if (valid.length === 0) return null;
        const conversion = fx as Partial<DerivedCurrencyConversion> | null;
        if (!conversion?.targetCurrency || !conversion.rates) {
          const currency = valid[0]!.currency;
          if (valid.some(value => value.currency !== currency)) return null;
          return { amount: valid.reduce((total, value) => total + value.amount, 0), currency };
        }
        const targetRate = conversion.rates[conversion.targetCurrency];
        if (targetRate == null || !(targetRate > 0)) return null;
        let amount = 0;
        for (const value of valid) {
          const sourceRate = conversion.rates[value.currency.toUpperCase()];
          if (sourceRate == null || !(sourceRate > 0)) return null;
          amount += (value.amount * targetRate) / sourceRate;
        }
        return { amount, currency: conversion.targetCurrency };
      }
    }),
    // Missing properties read as null in Bonsai 1.x.
    isBlank: fn({
      params: [t.any()],
      returns: t.boolean(),
      run: value => value == null || value === '' || (Array.isArray(value) && value.length === 0)
    })
  }
});

const derivedField = (field: DerivableField): DerivedFieldDefinition | null =>
  field.type === 'derived'
    ? {
        id: field.id,
        expression: field.expression,
        resultType: field.resultType,
        recalcInterval: (field as { recalc_interval?: DerivedRecalcInterval }).recalc_interval
      }
    : null;

const directRootProperty = (node: Node, root: DerivedRoot): string | undefined => {
  if (node.type === 'Member' && node.object.type === 'Variable' && node.object.name === root) {
    return node.name;
  }
  if (
    node.type === 'Index' &&
    node.object.type === 'Variable' &&
    node.object.name === root &&
    node.index.type === 'Literal' &&
    typeof node.index.value === 'string'
  ) {
    return node.index.value;
  }
  return undefined;
};

const collectRootDependencies = (node: Node, root: DerivedRoot, dependencies: string[]) => {
  const property = directRootProperty(node, root);
  // `metadata`, `referrers`, `now`, and `fx` are projection/injected values, not schema fields.
  if (
    property &&
    property !== 'metadata' &&
    property !== 'referrers' &&
    property !== 'now' &&
    property !== 'fx'
  ) {
    dependencies.push(property);
  }
  forEachChild(node, child => collectRootDependencies(child, root, dependencies));
};

const collectObjectLiteralKeys = (node: Node, keys: Set<string>) => {
  if (node.type === 'Map') {
    for (const entry of node.entries) {
      if (entry.type === 'Entry' && typeof entry.key === 'string') keys.add(entry.key);
    }
  }
  forEachChild(node, child => collectObjectLiteralKeys(child, keys));
};

/** Root keys injected by the engine that change over time: the current date and the exchange rates. */
const TIME_DEPENDENT_ROOT_KEYS = new Set(['now', 'fx']);

/** True when the AST reads `<root>.now` or `<root>.fx` anywhere (injected values that go stale). */
const referencesRootNow = (node: Node, root: DerivedRoot): boolean =>
  TIME_DEPENDENT_ROOT_KEYS.has(directRootProperty(node, root) ?? '') ||
  (() => {
    let found = false;
    forEachChild(node, child => {
      if (!found && referencesRootNow(child, root)) found = true;
    });
    return found;
  })();

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
  const compiled = new Map<string, Program>();
  const dependencies = new Map<string, string[]>();
  const references = new Map<string, string[]>();
  const timeDependentFieldIds = new Set<string>();

  for (const definition of definitions) {
    const validation = engine.check(definition.expression);
    if (!validation.ok) {
      throw new Error(
        `Invalid expression for derived field '${definition.id}': ${validation.diagnostics
          .map(diagnostic => diagnostic.formatted)
          .join('; ')}`
      );
    }
    const program = validation.program;
    const objectLiteralKeys = new Set<string>();
    collectObjectLiteralKeys(program.ast, objectLiteralKeys);
    const unsupportedIdentifiers = program.references.variables.filter(
      identifier => identifier !== root && !objectLiteralKeys.has(identifier)
    );
    if (unsupportedIdentifiers.length > 0) {
      throw new Error(
        `Derived field '${definition.id}' may only reference fields through ${root} — found ${unsupportedIdentifiers.join(', ')}`
      );
    }

    const fieldDependencies: string[] = [];
    collectRootDependencies(program.ast, root, fieldDependencies);
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
    compiled.set(definition.id, program);

    const usesNow = referencesRootNow(program.ast, root);
    if (usesNow) {
      timeDependentFieldIds.add(definition.id);
      // A time-dependent value only advances when the recurring scan job recomputes it; default
      // the cadence so an author can't silently ship a value that never refreshes.
      if (!definition.recalcInterval) definition.recalcInterval = 'daily';
    } else if (definition.recalcInterval) {
      throw new Error(
        `Derived field '${definition.id}' sets recalc_interval but its expression does not reference ${root}.now or ${root}.fx`
      );
    }
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

  return { fields: ordered, compiled, dependencies, references, root, timeDependentFieldIds };
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
    case 'duration': {
      const parsed = parseDurationValue(value);
      if (!parsed) throw new Error('Expected a duration with a non-negative amount and a unit');
      return parsed;
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
  entityContext: DerivedEntityContext = inputValues,
  now: Date = new Date(),
  fx?: DerivedCurrencyConversion
): Record<string, unknown> => {
  const values = { ...inputValues };
  // `<root>.now` — the current date as an ISO day string, so expressions can compute
  // approaching/overdue windows. Injected here (the one path every root funnels through) rather
  // than in each projection builder.
  const rootContext: Record<string, unknown> = {
    ...entityContext,
    now: toIsoDay(now),
    ...(fx ? { fx } : {})
  };
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
  entityContext?: DerivedEntityContext,
  now: Date = new Date(),
  fx?: DerivedCurrencyConversion
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
    entityContext ?? values,
    now,
    fx
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
