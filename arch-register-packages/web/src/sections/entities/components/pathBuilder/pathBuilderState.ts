import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';

// Shared hop/path-traversal logic behind Traceability's and Map's hop editors. Operates on the
// full `PathStep` union (entityQueryIR.ts) - forward/backward/typedRelation/unboundTypedRelation
// only; the relation-rooted kinds (endpoint/relationForward/relationBackward) are never offered
// here since these editors always start on an entity, not a relation row.

export type PathSchemaScope = 'any' | readonly string[];

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

/** Whether `chain`'s leaf (last) node matches `targetSchemaIds` - `'any'` always matches. A
 *  target restricts which matched chains are kept, based on the leaf hop's schema, not just which
 *  candidate entities are checked elsewhere (e.g. Traceability's orphan detection). Shared by
 *  Traceability's per-path target filter and Map's last-level target filter (#3040-map). */
export const chainMatchesTarget = (chain: PathChain, targetSchemaIds: 'any' | string[]): boolean => {
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
      return relation ? resolveEndpointSchemaIds(relation, oppositeEndpoint(step.direction), schemas) : [];
    }
    default:
      return [];
  }
};

const schemasInScope = (schemas: EntitySchema[], scope: PathSchemaScope): EntitySchema[] =>
  scope === 'any' ? schemas : schemas.filter(schema => scope.includes(schema.id));

const fieldGroupAllowed = (
  schema: EntitySchema,
  field: EntitySchema['fields'][number],
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
    default:
      return step.kind;
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

  for (const schema of scopedSchemas) {
    for (const field of schema.fields) {
      if (field.type !== 'typedRelation' || field.direction !== direction) continue;
      if (!fieldGroupAllowed(schema, field, getFieldGroupAccess)) continue;
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
  const availableDirections = (['in', 'out'] as const).filter(
    candidate =>
      pathStepOptions({
        direction: candidate,
        currentSchemaScope,
        schemas,
        relationSchemas,
        getFieldGroupAccess
      }).length > 0
  );
  const options = pathStepOptions({
    direction,
    currentSchemaScope,
    schemas,
    relationSchemas,
    getFieldGroupAccess
  });
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
export const pathStepContextWithFallbackDirection = (args: PathStepContextArgs): PathStepContext => {
  const context = pathStepContext(args);
  if (args.steps[args.depth] || context.options.length > 0) return context;
  const altDirection = context.availableDirections.find(direction => direction !== context.direction);
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
