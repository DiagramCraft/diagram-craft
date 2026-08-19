import type { EntityQuery, PathStep } from '@arch-register/api-types/entityQueryIR';
import {
  traceabilityViewConfigSchema,
  type TraceabilityViewConfig
} from '@arch-register/api-types/viewContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import type { BrowserEntityRecord } from './entityBrowserState';

export const TRACEABILITY_PROJECTION_PREFIX = '__traceability__';

export type TraceabilityProjectionAliases = {
  pathId: string;
  alias: string;
};

/** One matched chain is one full root-to-leaf hop sequence (e.g. Domain -> System -> Component) -
 *  kept as its own ordered node list so branches (a Domain with multiple Systems, each with their
 *  own Components) render as separate lines instead of being pooled into one flat, uncorrelated
 *  bag of nodes. */
export type TraceabilityChain = Array<{ id: string; name: string; schemaId: string }>;

export type TraceabilityPathResult = {
  pathId: string;
  label: string;
  chains: TraceabilityChain[];
};

export type TraceabilityRoot = {
  root: BrowserEntityRecord;
  graphNodeIds: Set<string>;
  paths: TraceabilityPathResult[];
};

export type TraceabilityProjectMemberships = ReadonlyMap<string, readonly string[]>;

export type TraceabilitySchemaScope = 'any' | readonly string[];

/** A selectable next hop: which `PathStep` it builds, its display label, and the entity
 *  schema(s) reachable after taking it. */
export type TraceabilityPathOption = {
  step: PathStep;
  label: string;
  targetSchemaIds: string[];
  /** Display group for the hop editor's dropdown (`<optgroup>`), matching the display-priority
   *  order: Containment, Reference, Typed relation, Relation. */
  group: string;
};

export type TraceabilityPathStepContext = {
  currentSchemaScope: TraceabilitySchemaScope;
  /** Direction of the step at this depth ('out' for forward/typedRelation(out)/unboundTypedRelation(out),
   *  'in' for backward/typedRelation(in)/unboundTypedRelation(in)). Defaults to 'out' when there is no
   *  step yet at this depth (i.e. this context describes where a new hop would be added). */
  direction: 'in' | 'out';
  /** Legal next-hop options for `direction` at `currentSchemaScope`. */
  options: TraceabilityPathOption[];
  /** Directions with at least one legal option at `currentSchemaScope`. */
  availableDirections: Array<'in' | 'out'>;
  invalid: boolean;
};

export type TraceabilityCoverageRow = TraceabilityRoot & {
  architectureCovered: boolean;
  alignedProjects: Project[];
  activeDelivery: {
    projects: Project[];
  };
  deliveryCovered: boolean;
};

export type TraceabilityCoverage = {
  rows: TraceabilityCoverageRow[];
  orphanProjectIds: Set<string>;
  coveredEntityIds: Set<string>;
};

const isChainNode = (value: unknown): value is { id: string; name: unknown; schemaId: unknown } =>
  value != null && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string';

// The chain aggregate has no defined order (no ORDER BY inside json_agg/json_group_array), so
// display order is sorted client-side rather than left to incidental DB row order.
const compareChains = (left: TraceabilityChain, right: TraceabilityChain): number => {
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
const toChains = (value: unknown): TraceabilityChain[] => {
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

const chainProjectionAlias = (pathId: string) => `${TRACEABILITY_PROJECTION_PREFIX}${pathId}:chain`;

export const parseTraceabilityConfig = (config: unknown): TraceabilityViewConfig | null => {
  const result = traceabilityViewConfigSchema.safeParse(config);
  return result.success ? result.data : null;
};

const endpointAllowsScope = (
  endpoint: RelationSchema['in'],
  scope: TraceabilitySchemaScope
): boolean =>
  endpoint.schemaIds === 'any' ||
  scope === 'any' ||
  scope.some(schemaId => endpoint.schemaIds.includes(schemaId));

const oppositeEndpoint = (direction: 'in' | 'out'): 'in' | 'out' =>
  direction === 'in' ? 'out' : 'in';

export const traceabilityRelationDirections = (
  relation: RelationSchema,
  scope: TraceabilitySchemaScope
): Array<'in' | 'out'> =>
  (['in', 'out'] as const).filter(direction => endpointAllowsScope(relation[direction], scope));

export const traceabilityCompatibleRelations = (
  relations: RelationSchema[],
  scope: TraceabilitySchemaScope
): RelationSchema[] =>
  relations.filter(relation => traceabilityRelationDirections(relation, scope).length > 0);

const resolveEndpointSchemaIds = (
  relation: RelationSchema,
  endpoint: 'in' | 'out',
  schemas: EntitySchema[]
): string[] => {
  const schemaIds = relation[endpoint].schemaIds;
  return schemaIds === 'any' ? schemas.map(schema => schema.id) : schemaIds;
};

const schemasInScope = (schemas: EntitySchema[], scope: TraceabilitySchemaScope): EntitySchema[] =>
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
 *  'out' as '←' — see the comment in `traceabilityPathOptions`): 'in' for self-owned/outward
 *  steps, 'out' for reverse-lookup/inward steps. Relation-rooted kinds
 *  (endpoint/relationForward/relationBackward) aren't built by traceability paths. */
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
 *  since traceability scopes can be a union of schemas (mixed-root paths). */
export const traceabilityPathOptions = ({
  direction,
  currentSchemaScope,
  schemas,
  relationSchemas,
  getFieldGroupAccess = () => 'edit'
}: {
  direction: 'in' | 'out';
  currentSchemaScope: TraceabilitySchemaScope;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): TraceabilityPathOption[] => {
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
  const optionsByKey = new Map<string, TraceabilityPathOption & { priority: number }>();
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
    if (!traceabilityRelationDirections(relation, currentSchemaScope).includes(direction)) continue;
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

/** Buckets an already-sorted `traceabilityPathOptions()` result into consecutive `{ group,
 *  options }` runs, for rendering as `<optgroup>` elements. Relies on the options already being
 *  grouped by priority; grouping by any other order would silently split a kind into duplicate
 *  optgroups. */
export const groupTraceabilityOptions = (
  options: TraceabilityPathOption[]
): Array<{ group: string; options: TraceabilityPathOption[] }> => {
  const groups: Array<{ group: string; options: TraceabilityPathOption[] }> = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }
  return groups;
};

const nextTraceabilitySchemaScope = (
  step: PathStep,
  currentScope: TraceabilitySchemaScope,
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): TraceabilitySchemaScope => {
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

export const traceabilityPathStepContext = ({
  rootSchemaScope,
  path,
  depth,
  schemas,
  relationSchemas,
  getFieldGroupAccess
}: {
  rootSchemaScope: TraceabilitySchemaScope;
  path: TraceabilityViewConfig['paths'][number];
  depth: number;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): TraceabilityPathStepContext => {
  let currentSchemaScope = rootSchemaScope;

  for (let index = 0; index < depth; index += 1) {
    const priorStep = path.path[index];
    currentSchemaScope = priorStep
      ? nextTraceabilitySchemaScope(priorStep, currentSchemaScope, schemas, relationSchemas)
      : 'any';
  }

  const step = path.path[depth];
  const direction = step ? stepDirection(step) : 'in';
  const availableDirections = (['in', 'out'] as const).filter(
    candidate =>
      traceabilityPathOptions({
        direction: candidate,
        currentSchemaScope,
        schemas,
        relationSchemas,
        getFieldGroupAccess
      }).length > 0
  );
  const options = traceabilityPathOptions({
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

/** Truncates each path to its longest still-valid prefix, dropping paths entirely if even their
 *  first hop is no longer valid (a path can't have zero hops). Used to auto-recover when upstream
 *  schema/relation availability changes out from under a saved path (e.g. a sidebar filter change
 *  narrows the root schema scope) - rather than leaving a hop the user can't fix because its own
 *  option no longer appears in the dropdown, silently drop it and everything after it. Returns the
 *  same `config` reference when nothing needed pruning, so callers can skip a no-op config write. */
export const pruneInvalidTraceabilityPaths = (
  config: TraceabilityViewConfig,
  {
    rootSchemaScope,
    schemas,
    relationSchemas,
    getFieldGroupAccess
  }: {
    rootSchemaScope: TraceabilitySchemaScope;
    schemas: EntitySchema[];
    relationSchemas: RelationSchema[];
    getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  }
): TraceabilityViewConfig => {
  let changed = false;
  const paths = config.paths.flatMap(path => {
    let validLength = path.path.length;
    for (let depth = 0; depth < path.path.length; depth += 1) {
      const stepContext = traceabilityPathStepContext({
        rootSchemaScope,
        path,
        depth,
        schemas,
        relationSchemas,
        getFieldGroupAccess
      });
      if (stepContext.invalid) {
        validLength = depth;
        break;
      }
    }
    if (validLength === path.path.length) return [path];
    changed = true;
    return validLength === 0 ? [] : [{ ...path, path: path.path.slice(0, validLength) }];
  });
  return changed ? { ...config, paths } : config;
};

export const buildTraceabilityEntityQuery = (
  query: EntityQuery | null | undefined,
  config: unknown
): { query: EntityQuery | null; aliases: TraceabilityProjectionAliases[] } => {
  const parsed = parseTraceabilityConfig(config);
  if (!parsed) return { query: query ?? null, aliases: [] };

  const aliases = parsed.paths
    .filter(path => path.path.length > 0)
    .map(path => ({ pathId: path.id, alias: chainProjectionAlias(path.id) }));
  const baseQuery: EntityQuery = query ?? {
    root: { kind: 'and', children: [] }
  };
  const existingAliases = new Set(
    (baseQuery.projections ?? []).map(projection => projection.alias)
  );
  const projections = aliases.flatMap(entry => {
    if (existingAliases.has(entry.alias)) return [];
    const path = parsed.paths.find(candidate => candidate.id === entry.pathId)?.path ?? [];
    return [{ path, fieldId: '_id', alias: entry.alias, chain: true }];
  });

  return {
    query: { ...baseQuery, projections: [...(baseQuery.projections ?? []), ...projections] },
    aliases
  };
};

// A path's `targetSchemaIds` restricts which matched chains are kept, based on the leaf
// (terminal) hop's schema - not just which candidate entities are checked for orphan status.
const chainMatchesTarget = (
  chain: TraceabilityChain,
  targetSchemaIds: TraceabilityViewConfig['paths'][number]['targetSchemaIds']
): boolean => {
  if (targetSchemaIds === 'any') return true;
  const leaf = chain[chain.length - 1];
  return leaf != null && targetSchemaIds.includes(leaf.schemaId);
};

export const buildTraceabilityRoots = (
  rows: BrowserEntityRecord[],
  aliases: TraceabilityProjectionAliases[],
  config: unknown
): TraceabilityRoot[] => {
  const parsed = parseTraceabilityConfig(config);
  if (!parsed) return [];

  const aliasByPath = new Map(aliases.map(entry => [entry.pathId, entry.alias]));

  return rows.map(root => {
    const graphNodeIds = new Set([root._uid]);
    const paths = parsed.paths.map(path => {
      const alias = aliasByPath.get(path.id);
      const chains = (alias ? toChains(root._projections?.[alias]) : []).filter(chain =>
        chainMatchesTarget(chain, path.targetSchemaIds)
      );
      chains.forEach(chain => chain.forEach(node => graphNodeIds.add(node.id)));
      return { pathId: path.id, label: path.label, chains };
    });
    return { root, graphNodeIds, paths };
  });
};

export const buildTraceabilityCoverage = ({
  roots,
  projects,
  memberships
}: {
  roots: TraceabilityRoot[];
  projects: Project[];
  memberships: TraceabilityProjectMemberships;
}): TraceabilityCoverage => {
  const rows = roots.map(root => {
    const alignedProjects = projects.filter(project =>
      (memberships.get(project.id) ?? []).some(entityId => root.graphNodeIds.has(entityId))
    );
    const activeDelivery = {
      projects: alignedProjects.filter(project => project.status === 'active')
    };
    return {
      ...root,
      architectureCovered: root.paths.some(path => path.chains.length > 0),
      alignedProjects,
      activeDelivery,
      deliveryCovered: activeDelivery.projects.length > 0
    };
  });

  const coveredEntityIds = new Set(roots.flatMap(root => [...root.graphNodeIds]));
  const orphanProjectIds = new Set(
    projects
      .filter(project => !(memberships.get(project.id) ?? []).some(id => coveredEntityIds.has(id)))
      .map(project => project.id)
  );
  return { rows, orphanProjectIds, coveredEntityIds };
};

export const collectTargetSchemaIds = (config: TraceabilityViewConfig) => [
  ...new Set(
    config.paths.flatMap(path => (path.targetSchemaIds === 'any' ? [] : path.targetSchemaIds))
  )
];

export const hasAnyTargetSchema = (config: TraceabilityViewConfig) =>
  config.paths.some(path => path.targetSchemaIds === 'any');

export const entityIsOrphan = (entity: EntityRecord, coveredEntityIds: Set<string>) =>
  !coveredEntityIds.has(entity._uid);
