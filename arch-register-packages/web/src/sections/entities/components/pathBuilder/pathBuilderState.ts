import type { EntityQuery, PathStep } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { isEntityRelationField } from '@arch-register/api-types/relationSchemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';

// Shared hop/path-traversal logic behind Traceability's and Map's hop editors, and (via the
// position-aware `position*` exports below, #3120) the Relations Browser's relationForward filter
// and projection editors. The original entity-only exports (`pathStepOptions`, `pathStepContext`,
// `pathStepContextWithFallbackDirection`, `pruneInvalidPathSteps`, `targetSchemaIdsForStep`) operate
// on the four entity-to-entity `PathStep` kinds only (forward/backward/typedRelation/
// unboundTypedRelation) and keep their existing behavior unchanged - Traceability and Map always
// start on an entity and never see a relation-rooted kind. The `position*` exports additionally
// track whether the path is currently on an entity or a relation row, so they can offer
// `endpoint`/`relationForward` (relation -> entity) and `relationBackward` (entity -> relation) too.

export type PathSchemaScope = 'any' | readonly string[];

/** Where a path currently is: on an entity (scoped to `schemaScope`, same shape as the legacy
 *  entity-only API), or on a relation instance (scoped to `relationScope`, relation schema ids).
 *  A relation-rooted query/`relationExists` path, or the position right after a `relationBackward`
 *  step, is `'relation'`; everything else - including the very start of an entity-rooted path - is
 *  `'entity'`. */
export type PathPosition =
  | { kind: 'entity'; schemaScope: PathSchemaScope }
  | { kind: 'relation'; relationScope: PathSchemaScope };

/** One matched chain is one full root-to-leaf hop sequence (e.g. Domain -> System -> Component) -
 *  kept as its own ordered node list so branches (a Domain with multiple Systems, each with their
 *  own Components) render as separate lines/subtrees instead of being pooled into one flat,
 *  uncorrelated bag of nodes. Produced by a `chain: true` projection (entityQueryIR.ts). */
export type PathChain = Array<{ id: string; name: string; schemaId: string }>;

const isChainNode = (value: unknown): value is { id: string; name: unknown; schemaId: unknown } =>
  value != null && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string';

// The chain aggregate has no defined order (no ORDER BY inside json_agg/json_group_array), so
// display order is sorted client-side rather than left to incidental DB row order.
const compareChains = (left: PathChain, right: PathChain): number => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const cmp = (left[index]?.name ?? '').localeCompare(right[index]?.name ?? '');
    if (cmp !== 0) return cmp;
  }
  return 0;
};

/** Decodes a `chain: true` projection value: an array of matched chains, each an array of
 *  per-hop `{ id, name, schemaId }` nodes in hop order, sorted hop-by-hop for a stable display
 *  order. Malformed/short chains are dropped defensively rather than partially rendered. */
export const decodeChainProjection = (value: unknown): PathChain[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((chain): chain is unknown[] => Array.isArray(chain) && chain.length > 0)
    .map(chain =>
      chain.filter(isChainNode).map(node => ({
        id: node.id,
        name: typeof node.name === 'string' ? node.name : node.id,
        schemaId: typeof node.schemaId === 'string' ? node.schemaId : ''
      }))
    )
    .filter(chain => chain.length > 0)
    .sort(compareChains);
};

/** Adds a single correlated `chain: true` projection for `path` (aliased `alias`) onto `query`'s
 *  root scope, unless a projection with that alias already exists - shared by Map's
 *  `buildMapChainQuery` and Traceability's `buildTraceabilityEntityQuery` so the two ways of
 *  attaching a chain to a query can't drift apart. An empty `path` adds no projection, since
 *  `chain: true` requires a non-empty path. */
export const addChainProjection = (
  query: EntityQuery | null | undefined,
  path: PathStep[],
  alias: string
): EntityQuery => {
  const baseQuery: EntityQuery = query ?? { root: { kind: 'and', children: [] } };
  if (path.length === 0) return baseQuery;
  if ((baseQuery.projections ?? []).some(p => p.alias === alias)) return baseQuery;
  return {
    ...baseQuery,
    projections: [...(baseQuery.projections ?? []), { path, fieldId: '_id', alias, chain: true }]
  };
};

/** Whether `chain`'s leaf (last) node matches `targetSchemaIds` - `'any'` always matches. A
 *  target restricts which matched chains are kept, based on the leaf hop's schema, not just which
 *  candidate entities are checked elsewhere (e.g. Traceability's orphan detection). Shared by
 *  Traceability's per-path target filter and Map's last-level target filter (#3040-map). */
export const chainMatchesTarget = (
  chain: PathChain,
  targetSchemaIds: 'any' | string[]
): boolean => {
  if (targetSchemaIds === 'any') return true;
  const leaf = chain[chain.length - 1];
  return leaf != null && targetSchemaIds.includes(leaf.schemaId);
};

/** A selectable next hop: which `PathStep` it builds, its display label, and the entity
 *  schema(s) reachable after taking it. */
export type PathStepOption = {
  step: PathStep;
  label: string;
  targetSchemaIds: string[];
  /** Display group for the hop editor's dropdown (`<optgroup>`), matching the display-priority
   *  order: Containment, Reference, Typed relation, Relation. */
  group: string;
};

export type PathStepContext = {
  currentSchemaScope: PathSchemaScope;
  /** Direction of the step at this depth ('out' for forward/typedRelation(out)/unboundTypedRelation(out),
   *  'in' for backward/typedRelation(in)/unboundTypedRelation(in)). Defaults to 'out' when there is no
   *  step yet at this depth (i.e. this context describes where a new hop would be added). */
  direction: 'in' | 'out';
  /** Legal next-hop options for `direction` at `currentSchemaScope`. */
  options: PathStepOption[];
  /** Directions with at least one legal option at `currentSchemaScope`. */
  availableDirections: Array<'in' | 'out'>;
  invalid: boolean;
};

const endpointAllowsScope = (endpoint: RelationSchema['in'], scope: PathSchemaScope): boolean =>
  endpoint.schemaIds === 'any' ||
  scope === 'any' ||
  scope.some(schemaId => endpoint.schemaIds.includes(schemaId));

const oppositeEndpoint = (direction: 'in' | 'out'): 'in' | 'out' =>
  direction === 'in' ? 'out' : 'in';

export const pathRelationDirections = (
  relation: RelationSchema,
  scope: PathSchemaScope
): Array<'in' | 'out'> =>
  (['in', 'out'] as const).filter(direction => endpointAllowsScope(relation[direction], scope));

export const pathCompatibleRelations = (
  relations: RelationSchema[],
  scope: PathSchemaScope
): RelationSchema[] =>
  relations.filter(relation => pathRelationDirections(relation, scope).length > 0);

const resolveEndpointSchemaIds = (
  relation: RelationSchema,
  endpoint: 'in' | 'out',
  schemas: EntitySchema[]
): string[] => {
  const schemaIds = relation[endpoint].schemaIds;
  return schemaIds === 'any' ? schemas.map(schema => schema.id) : schemaIds;
};

/** Every entity schema `step` can land on, derived directly from the step's own fields - doesn't
 *  need a schema scope/option enumeration the way `pathStepOptions` does, so it works even for a
 *  step that's already been picked (e.g. recovering the schema a saved-but-unresolved map level
 *  should have, #3040-map). A `forward` field id is assumed unambiguous across schemas here (first
 *  match wins), matching the "first match" convention used elsewhere for fieldId collisions. */
export const targetSchemaIdsForStep = (
  step: PathStep,
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): string[] => {
  switch (step.kind) {
    case 'forward': {
      for (const schema of schemas) {
        const field = schema.fields.find(candidate => candidate.id === step.fieldId);
        if (field && (field.type === 'reference' || field.type === 'containment')) {
          return [field.schemaId];
        }
      }
      return [];
    }
    case 'backward':
      return [step.ownerSchemaId];
    case 'typedRelation':
    case 'unboundTypedRelation': {
      const relation = relationSchemas.find(candidate => candidate.id === step.relationSchemaId);
      return relation
        ? resolveEndpointSchemaIds(relation, oppositeEndpoint(step.direction), schemas)
        : [];
    }
    default:
      return [];
  }
};

const schemasInScope = (schemas: EntitySchema[], scope: PathSchemaScope): EntitySchema[] =>
  scope === 'any' ? schemas : schemas.filter(schema => scope.includes(schema.id));

const relationsInScope = (
  relationSchemas: RelationSchema[],
  scope: PathSchemaScope
): RelationSchema[] =>
  scope === 'any'
    ? relationSchemas
    : relationSchemas.filter(relation => scope.includes(relation.id));

/** Structural, not `EntitySchema`-specific, so the same check works for a `RelationSchema`/
 *  `RelationField` pair too (both shapes carry `groups: { id, accessControl }[]` and an optional
 *  `field.groupId`) - used by the relation-context option enumeration below as well. */
const fieldGroupAllowed = (
  schema: { groups?: ReadonlyArray<{ id: string; accessControl?: FieldGroupAccessControl }> },
  field: { groupId?: string },
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess
): boolean => {
  if (!field.groupId) return true;
  const group = schema.groups?.find(candidate => candidate.id === field.groupId);
  return getFieldGroupAccess(group?.accessControl) !== 'none';
};

/** Stable identity for a `PathStep`, used to compare a saved step against the current option set
 *  (schema/relation-schema changes underneath a saved path are what make a step become invalid),
 *  and as a React/`<select>` key for hop options. */
export const pathStepKey = (step: PathStep): string => {
  switch (step.kind) {
    case 'forward':
      return `forward:${step.fieldId}`;
    case 'backward':
      return `backward:${step.fieldId}:${step.ownerSchemaId}`;
    case 'typedRelation':
      return `typedRelation:${step.fieldId}:${step.relationSchemaId}:${step.direction}`;
    case 'unboundTypedRelation':
      return `unboundTypedRelation:${step.relationSchemaId}:${step.direction}`;
    case 'endpoint':
      return `endpoint:${step.direction}`;
    case 'relationForward':
      return `relationForward:${step.fieldId}`;
    case 'relationBackward':
      return `relationBackward:${step.fieldId}:${step.relationSchemaId}`;
  }
};

/** Direction bucket a step belongs to for the hop editor's direction toggle ('in' renders as '→',
 *  'out' as '←' — see the comment in `pathStepOptions`): 'in' for self-owned/outward steps, 'out'
 *  for reverse-lookup/inward steps. Relation-rooted kinds (endpoint/relationForward/
 *  relationBackward) aren't built by these hop editors. */
const stepDirection = (step: PathStep): 'in' | 'out' => {
  switch (step.kind) {
    case 'forward':
      return 'in';
    case 'backward':
      return 'out';
    case 'typedRelation':
    case 'unboundTypedRelation':
      return step.direction;
    // Grouped alongside 'backward'/'unboundTypedRelation' in the entity-side 'out' bucket - a
    // relationBackward field is owned by another schema (the relation), same as those two kinds.
    case 'relationBackward':
      return 'out';
    case 'endpoint':
      return step.direction;
    default:
      return 'in';
  }
};

/** Every legal next hop for `direction` at `currentSchemaScope`: plain reference/containment
 *  fields, typed-relation fields, and unbound relation-schema traversals. Modeled on
 *  `getMetricPathOptions` in mapMetricConfig.ts, generalized to a (possibly multi-schema) scope
 *  since a scope can be a union of schemas (mixed-root paths, or Map's filter-driven Level 1). */
export const pathStepOptions = ({
  direction,
  currentSchemaScope,
  schemas,
  relationSchemas,
  getFieldGroupAccess = () => 'edit'
}: {
  direction: 'in' | 'out';
  currentSchemaScope: PathSchemaScope;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): PathStepOption[] => {
  const scopedSchemas = schemasInScope(schemas, currentSchemaScope);
  const schemaNameById = new Map(schemas.map(schema => [schema.id, schema.name]));
  // Display order/grouping: containment first, then plain reference fields, then typed-relation
  // fields bound to a projection field, then unbound relation-schema traversals - roughly "most
  // specific/structural" to "most generic" hop kind.
  const OPTION_TIERS = {
    containment: { priority: 0, group: 'Containment' },
    reference: { priority: 1, group: 'Reference' },
    typedRelation: { priority: 2, group: 'Typed relation' },
    unboundTypedRelation: { priority: 3, group: 'Relation' }
  } as const;
  const optionsByKey = new Map<string, PathStepOption & { priority: number }>();
  const addOption = (
    step: PathStep,
    label: string,
    targetSchemaIds: string[],
    tier: (typeof OPTION_TIERS)[keyof typeof OPTION_TIERS]
  ) => {
    const key = pathStepKey(step);
    const existing = optionsByKey.get(key);
    if (existing) {
      existing.targetSchemaIds = [...new Set([...existing.targetSchemaIds, ...targetSchemaIds])];
      // Multiple schemas in a union scope can grant the same typedRelation field id; keep
      // ownerSchemaIds a true union too; it drives the full-coverage check below.
      if (existing.step.kind === 'typedRelation' && step.kind === 'typedRelation') {
        existing.step.ownerSchemaIds = [
          ...new Set([...existing.step.ownerSchemaIds, ...step.ownerSchemaIds])
        ];
      }
      return;
    }
    optionsByKey.set(key, {
      step,
      label,
      targetSchemaIds,
      group: tier.group,
      priority: tier.priority
    });
  };

  // Labeled as a sentence describing the relationship itself - "<owner> <predicate> <target>" -
  // rather than the traversal direction, so the same field reads identically whether it's walked
  // forward or backward (e.g. System's containment field on Domain always reads "System belongs
  // to Domain", not "Domain -> Domain" forward or "belongs to <- System" backward).
  const fieldRelationshipLabel = (
    ownerSchemaName: string,
    field: Extract<EntitySchema['fields'][number], { type: 'reference' | 'containment' }>
  ) =>
    `${ownerSchemaName} ${field.predicate ?? field.name} ${schemaNameById.get(field.schemaId) ?? field.schemaId}`;

  if (direction === 'in') {
    for (const schema of scopedSchemas) {
      for (const field of schema.fields) {
        if (field.type !== 'reference' && field.type !== 'containment') continue;
        if (!fieldGroupAllowed(schema, field, getFieldGroupAccess)) continue;
        addOption(
          { kind: 'forward', fieldId: field.id },
          fieldRelationshipLabel(schema.name, field),
          [field.schemaId],
          field.type === 'containment' ? OPTION_TIERS.containment : OPTION_TIERS.reference
        );
      }
    }
  } else {
    for (const ownerSchema of schemas) {
      for (const field of ownerSchema.fields) {
        if (field.type !== 'reference' && field.type !== 'containment') continue;
        if (!scopedSchemas.some(schema => schema.id === field.schemaId)) continue;
        if (!fieldGroupAllowed(ownerSchema, field, getFieldGroupAccess)) continue;
        addOption(
          { kind: 'backward', fieldId: field.id, ownerSchemaId: ownerSchema.id },
          fieldRelationshipLabel(ownerSchema.name, field),
          [ownerSchema.id],
          field.type === 'containment' ? OPTION_TIERS.containment : OPTION_TIERS.reference
        );
      }
    }
  }

  // Tracks, per relation/direction, whether the current scope has an owning `typedRelation`
  // field at all and whether any of them is field-group-viewable - mirrors the server's
  // `canViewTypedRelationFromEndpoint` (relationAccessControl.ts) default-allow-when-nothing-to-
  // restrict semantics for this one endpoint side, so the unbound relation-schema traversal below
  // isn't offered when every owning field for it is restricted from this scope.
  const relationFieldVisibility = new Map<string, { hasField: boolean; viewable: boolean }>();

  for (const schema of scopedSchemas) {
    for (const field of schema.fields) {
      if (field.type !== 'typedRelation' || field.direction !== direction) continue;
      const visibilityKey = `${field.relationSchemaId}:${direction}`;
      const visibility = relationFieldVisibility.get(visibilityKey) ?? {
        hasField: false,
        viewable: false
      };
      visibility.hasField = true;
      const allowed = fieldGroupAllowed(schema, field, getFieldGroupAccess);
      if (allowed) visibility.viewable = true;
      relationFieldVisibility.set(visibilityKey, visibility);
      if (!allowed) continue;
      const relation = relationSchemas.find(candidate => candidate.id === field.relationSchemaId);
      if (!relation) continue;
      addOption(
        {
          kind: 'typedRelation',
          fieldId: field.id,
          relationSchemaId: relation.id,
          direction,
          ownerSchemaIds: [schema.id]
        },
        `${field.name} (${relation.name})`,
        resolveEndpointSchemaIds(relation, oppositeEndpoint(direction), schemas),
        OPTION_TIERS.typedRelation
      );
    }
  }

  // Skip the unbound relation-schema traversal when every schema in scope already has a viewable
  // typedRelation field for it - the two would otherwise list the exact same traversal twice
  // (e.g. Objective's own "Affects"/"Supports" fields duplicating the relation-schema entries).
  // Left in when only some scope schemas have the field, since the unbound hop is then the only
  // way to reach entities via the schemas that don't.
  const fullyCoveredRelationDirections = new Set<string>();
  for (const option of optionsByKey.values()) {
    if (option.step.kind !== 'typedRelation') continue;
    const { ownerSchemaIds } = option.step;
    if (scopedSchemas.every(schema => ownerSchemaIds.includes(schema.id))) {
      fullyCoveredRelationDirections.add(
        `${option.step.relationSchemaId}:${option.step.direction}`
      );
    }
  }

  for (const relation of relationSchemas) {
    if (!pathRelationDirections(relation, currentSchemaScope).includes(direction)) continue;
    if (fullyCoveredRelationDirections.has(`${relation.id}:${direction}`)) continue;
    const visibility = relationFieldVisibility.get(`${relation.id}:${direction}`);
    if (visibility?.hasField && !visibility.viewable) continue;
    addOption(
      { kind: 'unboundTypedRelation', relationSchemaId: relation.id, direction },
      relation.name,
      resolveEndpointSchemaIds(relation, oppositeEndpoint(direction), schemas),
      OPTION_TIERS.unboundTypedRelation
    );
  }

  return [...optionsByKey.values()]
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
    .map(({ priority: _priority, ...option }) => option);
};

/** Buckets an already-sorted `pathStepOptions()` result into consecutive `{ group, options }`
 *  runs, for rendering as `<optgroup>` elements. Relies on the options already being grouped by
 *  priority; grouping by any other order would silently split a kind into duplicate optgroups. */
export const groupPathStepOptions = (
  options: PathStepOption[]
): Array<{ group: string; options: PathStepOption[] }> => {
  const groups: Array<{ group: string; options: PathStepOption[] }> = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }
  return groups;
};

const nextSchemaScope = (
  step: PathStep,
  currentScope: PathSchemaScope,
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): PathSchemaScope => {
  switch (step.kind) {
    case 'forward': {
      const targets = schemasInScope(schemas, currentScope).flatMap(schema => {
        const field = schema.fields.find(candidate => candidate.id === step.fieldId);
        return field && (field.type === 'reference' || field.type === 'containment')
          ? [field.schemaId]
          : [];
      });
      return targets.length > 0 ? [...new Set(targets)] : 'any';
    }
    case 'backward':
      return [step.ownerSchemaId];
    case 'typedRelation':
    case 'unboundTypedRelation': {
      const relation = relationSchemas.find(candidate => candidate.id === step.relationSchemaId);
      return relation
        ? resolveEndpointSchemaIds(relation, oppositeEndpoint(step.direction), schemas)
        : 'any';
    }
    default:
      return 'any';
  }
};

export const pathStepContext = ({
  rootSchemaScope,
  steps,
  depth,
  schemas,
  relationSchemas,
  getFieldGroupAccess
}: {
  rootSchemaScope: PathSchemaScope;
  steps: PathStep[];
  depth: number;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): PathStepContext => {
  let currentSchemaScope = rootSchemaScope;

  for (let index = 0; index < depth; index += 1) {
    const priorStep = steps[index];
    currentSchemaScope = priorStep
      ? nextSchemaScope(priorStep, currentSchemaScope, schemas, relationSchemas)
      : 'any';
  }

  const step = steps[depth];
  const direction = step ? stepDirection(step) : 'in';
  const optionsByDirection = {
    in: pathStepOptions({
      direction: 'in',
      currentSchemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    }),
    out: pathStepOptions({
      direction: 'out',
      currentSchemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    })
  };
  const availableDirections = (['in', 'out'] as const).filter(
    candidate => optionsByDirection[candidate].length > 0
  );
  const options = optionsByDirection[direction];
  const stepKey = step ? pathStepKey(step) : undefined;

  return {
    currentSchemaScope,
    direction,
    options,
    availableDirections,
    invalid: step != null && !options.some(option => pathStepKey(option.step) === stepKey)
  };
};

type PathStepContextArgs = Parameters<typeof pathStepContext>[0];

/** Like `pathStepContext`, but when there's no step yet at this depth and the *default* direction
 *  ('in') happens to have zero options, falls back to whichever direction actually has some
 *  (`availableDirections[0]`) instead of returning an empty option list - e.g. Domain has no
 *  outgoing containment field, so "System belongs to Domain" only ever shows up as the 'out'/
 *  'backward' option. Callers that need a *usable* default option (auto-selecting a fresh hop, or
 *  resolving which schema a freshly picked option lands on) should use this instead of
 *  `pathStepContext` directly - using the two inconsistently for the same hop is what let a step
 *  get saved without its resolved target schema (#3040-map). */
export const pathStepContextWithFallbackDirection = (
  args: PathStepContextArgs
): PathStepContext => {
  const context = pathStepContext(args);
  if (args.steps[args.depth] || context.options.length > 0) return context;
  const altDirection = context.availableDirections.find(
    direction => direction !== context.direction
  );
  if (!altDirection) return context;
  return {
    ...context,
    direction: altDirection,
    options: pathStepOptions({
      direction: altDirection,
      currentSchemaScope: context.currentSchemaScope,
      schemas: args.schemas,
      relationSchemas: args.relationSchemas,
      getFieldGroupAccess: args.getFieldGroupAccess
    })
  };
};

/** Truncates a hop sequence to its longest still-valid prefix, given the current schema/relation
 *  availability at `rootSchemaScope`. Used to auto-recover when upstream schema/relation
 *  availability changes out from under a saved path (e.g. a sidebar filter change narrows the root
 *  schema scope) - rather than leaving a hop the user can't fix because its own option no longer
 *  appears in the dropdown, silently drop it and everything after it. Returns the same `steps`
 *  reference when nothing needed pruning, so callers can skip a no-op config write. */
export const pruneInvalidPathSteps = (
  steps: PathStep[],
  {
    rootSchemaScope,
    schemas,
    relationSchemas,
    getFieldGroupAccess
  }: {
    rootSchemaScope: PathSchemaScope;
    schemas: EntitySchema[];
    relationSchemas: RelationSchema[];
    getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  }
): PathStep[] => {
  let validLength = steps.length;
  for (let depth = 0; depth < steps.length; depth += 1) {
    const context = pathStepContext({
      rootSchemaScope,
      steps,
      depth,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    if (context.invalid) {
      validLength = depth;
      break;
    }
  }
  return validLength === steps.length ? steps : steps.slice(0, validLength);
};

// --- Position-aware traversal (#3120) --------------------------------------------------------
//
// Everything below extends the entity-only machinery above with the three relation-rooted
// `PathStep` kinds (`endpoint`/`relationForward`/`relationBackward`, entityQueryIR.ts), for the
// Relations Browser's filter-leaf and projection editors. Additive only: none of the exports above
// change behavior, and these new exports are unused by Traceability/Map.

/** Every legal next hop from a relation row: the relation's fixed `in`/`out` endpoints, and one
 *  option per `entityRelation` field declared on a relation schema in `relationScope`
 *  (field-group-gated the same way a `typedRelation` entity field is). Unlike entity-side
 *  `pathStepOptions`, there's no in/out direction split - `endpoint`'s own direction is the option
 *  itself, and `relationForward` names an arbitrary field, not a direction. */
export const relationPositionOptions = ({
  relationScope,
  schemas,
  relationSchemas,
  getFieldGroupAccess = () => 'edit'
}: {
  relationScope: PathSchemaScope;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): PathStepOption[] => {
  const scopedRelations = relationsInScope(relationSchemas, relationScope);
  const schemaNameById = new Map(schemas.map(schema => [schema.id, schema.name]));
  const optionsByKey = new Map<string, PathStepOption>();

  for (const relation of scopedRelations) {
    for (const direction of ['in', 'out'] as const) {
      const key = `endpoint:${direction}`;
      const targetSchemaIds = resolveEndpointSchemaIds(relation, direction, schemas);
      const existing = optionsByKey.get(key);
      if (existing) {
        existing.targetSchemaIds = [...new Set([...existing.targetSchemaIds, ...targetSchemaIds])];
      } else {
        optionsByKey.set(key, {
          step: { kind: 'endpoint', direction },
          label: relation[direction].label ?? (direction === 'in' ? 'In' : 'Out'),
          targetSchemaIds,
          group: 'Endpoint'
        });
      }
    }

    for (const field of relation.fields) {
      if (!isEntityRelationField(field)) continue;
      if (!fieldGroupAllowed(relation, field, getFieldGroupAccess)) continue;
      const key = `relationForward:${field.id}`;
      if (optionsByKey.has(key)) continue;
      const targetName = schemaNameById.get(field.schemaId) ?? field.schemaId;
      optionsByKey.set(key, {
        step: { kind: 'relationForward', fieldId: field.id },
        label: field.predicate ? `${relation.name} ${field.predicate} ${targetName}` : field.name,
        targetSchemaIds: [field.schemaId],
        group: 'Relation field'
      });
    }
  }

  return [...optionsByKey.values()].sort(
    (a, b) =>
      (a.group === b.group ? 0 : a.group === 'Endpoint' ? -1 : 1) || a.label.localeCompare(b.label)
  );
};

/** Every legal `relationBackward` hop from an entity in `schemaScope`: one option per
 *  `entityRelation` field, on any relation schema, whose target schema intersects `schemaScope`.
 *  Bucketed under its own group so it appends after `pathStepOptions`' own groups without
 *  reordering them (mirrors `unboundTypedRelation`'s "most generic hop kind" placement, one tier
 *  more generic still since it leaves entity context entirely). */
/** Every legal `relationBackward` hop from an entity in `schemaScope` - exported for callers that
 *  need to compute entity-position 'out' options directly (e.g. a direction-toggle handler), in
 *  addition to being folded into `positionStepContext`'s own 'out' bucket. */
export const relationBackwardOptions = ({
  schemaScope,
  schemas,
  relationSchemas,
  getFieldGroupAccess = () => 'edit'
}: {
  schemaScope: PathSchemaScope;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): PathStepOption[] => {
  const scopedSchemas = schemasInScope(schemas, schemaScope);
  const options: PathStepOption[] = [];
  for (const relation of relationSchemas) {
    for (const field of relation.fields) {
      if (!isEntityRelationField(field)) continue;
      const targetSchema = scopedSchemas.find(schema => schema.id === field.schemaId);
      if (!targetSchema) continue;
      if (!fieldGroupAllowed(relation, field, getFieldGroupAccess)) continue;
      options.push({
        step: { kind: 'relationBackward', fieldId: field.id, relationSchemaId: relation.id },
        // Lands on a relation row, not an entity - there's no entity schema to report here.
        targetSchemaIds: [],
        label: field.predicate
          ? `${relation.name} ${field.predicate} ${targetSchema.name}`
          : `${relation.name} (${field.name})`,
        group: 'Relation traversal'
      });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
};

/** Position-aware counterpart of `targetSchemaIdsForStep`/`nextSchemaScope`: where a path ends up
 *  after taking `step` from `currentPosition`. `endpoint`/`relationForward` land on an entity
 *  (target scope is the union across every relation schema in the current relation scope, since a
 *  saved step doesn't itself carry which relation schema(s) granted it); `relationBackward` lands on
 *  the one relation schema it names; the four entity-to-entity kinds behave exactly as
 *  `nextSchemaScope` today and require an entity position. */
export const nextPosition = (
  step: PathStep,
  currentPosition: PathPosition,
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): PathPosition => {
  if (step.kind === 'relationBackward') {
    return { kind: 'relation', relationScope: [step.relationSchemaId] };
  }
  if (step.kind === 'endpoint' || step.kind === 'relationForward') {
    if (currentPosition.kind !== 'relation') return { kind: 'entity', schemaScope: 'any' };
    const scopedRelations = relationsInScope(relationSchemas, currentPosition.relationScope);
    const targets =
      step.kind === 'endpoint'
        ? scopedRelations.flatMap(relation =>
            resolveEndpointSchemaIds(relation, step.direction, schemas)
          )
        : scopedRelations.flatMap(relation => {
            const field = relation.fields.find(candidate => candidate.id === step.fieldId);
            return field && isEntityRelationField(field) ? [field.schemaId] : [];
          });
    return { kind: 'entity', schemaScope: targets.length > 0 ? [...new Set(targets)] : 'any' };
  }
  if (currentPosition.kind !== 'entity') return { kind: 'entity', schemaScope: 'any' };
  return {
    kind: 'entity',
    schemaScope: nextSchemaScope(step, currentPosition.schemaScope, schemas, relationSchemas)
  };
};

export type PositionedPathStepContext = {
  currentPosition: PathPosition;
  /** Meaningless (always `'out'`, ignored) at a relation position - see `hasDirectionToggle`. */
  direction: 'in' | 'out';
  options: PathStepOption[];
  availableDirections: Array<'in' | 'out'>;
  /** `false` at a relation position: `endpoint`/`relationForward` hops have no in/out toggle the
   *  way entity-to-entity hops do (a fixed pair of options vs. an arbitrary named field), so the
   *  hop editor should render a plain option list with no direction button. */
  hasDirectionToggle: boolean;
  invalid: boolean;
};

type PositionedContextArgs = {
  rootPosition: PathPosition;
  steps: PathStep[];
  depth: number;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
};

/** Position-aware counterpart of `pathStepContext`: walks `rootPosition` forward through
 *  `steps[0..depth)` via `nextPosition`, then enumerates legal options at that position - either
 *  the four entity-to-entity kinds plus `relationBackward` (entity position), or
 *  `endpoint`/`relationForward` (relation position). */
export const positionStepContext = ({
  rootPosition,
  steps,
  depth,
  schemas,
  relationSchemas,
  getFieldGroupAccess
}: PositionedContextArgs): PositionedPathStepContext => {
  let currentPosition = rootPosition;
  for (let index = 0; index < depth; index += 1) {
    const priorStep = steps[index];
    currentPosition = priorStep
      ? nextPosition(priorStep, currentPosition, schemas, relationSchemas)
      : { kind: 'entity', schemaScope: 'any' };
  }

  const step = steps[depth];
  const stepKey = step ? pathStepKey(step) : undefined;

  if (currentPosition.kind === 'relation') {
    const options = relationPositionOptions({
      relationScope: currentPosition.relationScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    return {
      currentPosition,
      direction: 'out',
      options,
      availableDirections: ['out'],
      hasDirectionToggle: false,
      invalid: step != null && !options.some(option => pathStepKey(option.step) === stepKey)
    };
  }

  const optionsByDirection = {
    in: pathStepOptions({
      direction: 'in',
      currentSchemaScope: currentPosition.schemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    }),
    out: [
      ...pathStepOptions({
        direction: 'out',
        currentSchemaScope: currentPosition.schemaScope,
        schemas,
        relationSchemas,
        getFieldGroupAccess
      }),
      ...relationBackwardOptions({
        schemaScope: currentPosition.schemaScope,
        schemas,
        relationSchemas,
        getFieldGroupAccess
      })
    ]
  };
  const direction = step ? stepDirection(step) : 'in';
  const availableDirections = (['in', 'out'] as const).filter(
    candidate => optionsByDirection[candidate].length > 0
  );
  const options = optionsByDirection[direction];

  return {
    currentPosition,
    direction,
    options,
    availableDirections,
    hasDirectionToggle: true,
    invalid: step != null && !options.some(option => pathStepKey(option.step) === stepKey)
  };
};

/** Position-aware counterpart of `pathStepContextWithFallbackDirection`: falls back to whichever
 *  direction actually has options when the default has none. Only meaningful at an entity position
 *  (a relation position has no direction toggle at all, `hasDirectionToggle: false`) - a no-op
 *  there. */
export const positionStepContextWithFallbackDirection = (
  args: PositionedContextArgs
): PositionedPathStepContext => {
  const context = positionStepContext(args);
  if (!context.hasDirectionToggle) return context;
  if (args.steps[args.depth] || context.options.length > 0) return context;
  const altDirection = context.availableDirections.find(
    direction => direction !== context.direction
  );
  if (!altDirection || context.currentPosition.kind !== 'entity') return context;
  return {
    ...context,
    direction: altDirection,
    options: [
      ...pathStepOptions({
        direction: altDirection,
        currentSchemaScope: context.currentPosition.schemaScope,
        schemas: args.schemas,
        relationSchemas: args.relationSchemas,
        getFieldGroupAccess: args.getFieldGroupAccess
      }),
      ...(altDirection === 'out'
        ? relationBackwardOptions({
            schemaScope: context.currentPosition.schemaScope,
            schemas: args.schemas,
            relationSchemas: args.relationSchemas,
            getFieldGroupAccess: args.getFieldGroupAccess
          })
        : [])
    ]
  };
};

/** Where a full hop chain ends up, position-aware - the relation-context counterpart of
 *  `terminalSchemaScope` (leafPath.ts), which only handles the four entity-to-entity kinds. */
export const terminalPosition = (
  steps: PathStep[],
  {
    rootPosition,
    schemas,
    relationSchemas
  }: {
    rootPosition: PathPosition;
    schemas: EntitySchema[];
    relationSchemas: RelationSchema[];
  }
): PathPosition =>
  steps.reduce(
    (position, step) => nextPosition(step, position, schemas, relationSchemas),
    rootPosition
  );

/** Position-aware counterpart of `pruneInvalidPathSteps`. */
export const prunePositionedPathSteps = (
  steps: PathStep[],
  {
    rootPosition,
    schemas,
    relationSchemas,
    getFieldGroupAccess
  }: {
    rootPosition: PathPosition;
    schemas: EntitySchema[];
    relationSchemas: RelationSchema[];
    getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  }
): PathStep[] => {
  let validLength = steps.length;
  for (let depth = 0; depth < steps.length; depth += 1) {
    const context = positionStepContext({
      rootPosition,
      steps,
      depth,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    if (context.invalid) {
      validLength = depth;
      break;
    }
  }
  return validLength === steps.length ? steps : steps.slice(0, validLength);
};
