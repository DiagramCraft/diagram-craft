import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  traceabilityViewConfigSchema,
  type TraceabilityViewConfig
} from '@arch-register/api-types/viewContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { BrowserEntityRecord } from './entityBrowserState';

export const TRACEABILITY_PROJECTION_PREFIX = '__traceability__';

export type TraceabilityProjectionAliases = {
  pathId: string;
  depth: number;
  id: string;
  name: string;
};

export type TraceabilityPathResult = {
  pathId: string;
  label: string;
  nodes: Array<{ id: string; name: string }>;
};

export type TraceabilityRoot = {
  root: BrowserEntityRecord;
  graphNodeIds: Set<string>;
  paths: TraceabilityPathResult[];
};

export type TraceabilityProjectMemberships = ReadonlyMap<string, readonly string[]>;

export type TraceabilitySchemaScope = 'any' | readonly string[];

export type TraceabilityPathStepContext = {
  currentSchemaScope: TraceabilitySchemaScope;
  compatibleRelations: RelationSchema[];
  compatibleDirections: Array<'in' | 'out'>;
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

const toProjectionValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
};

const projectionAlias = (pathId: string, depth: number, field: 'id' | 'name') =>
  `${TRACEABILITY_PROJECTION_PREFIX}${pathId}:${depth}:${field}`;

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

export const traceabilityCompatibleRelationsForDirection = (
  relations: RelationSchema[],
  scope: TraceabilitySchemaScope,
  direction: 'in' | 'out'
): RelationSchema[] =>
  relations.filter(relation => traceabilityRelationDirections(relation, scope).includes(direction));

export const traceabilityAvailableDirections = (
  relations: RelationSchema[],
  scope: TraceabilitySchemaScope
): Array<'in' | 'out'> =>
  (['in', 'out'] as const).filter(
    direction => traceabilityCompatibleRelationsForDirection(relations, scope, direction).length > 0
  );

export const traceabilityRelationIdForDirection = (
  relations: RelationSchema[],
  scope: TraceabilitySchemaScope,
  direction: 'in' | 'out',
  currentRelationId: string
): string | undefined => {
  const compatibleRelations = traceabilityCompatibleRelationsForDirection(
    relations,
    scope,
    direction
  );
  return (
    compatibleRelations.find(relation => relation.id === currentRelationId)?.id ??
    compatibleRelations[0]?.id
  );
};

const nextTraceabilitySchemaScope = (
  relation: RelationSchema,
  direction: 'in' | 'out'
): TraceabilitySchemaScope => relation[oppositeEndpoint(direction)].schemaIds;

export const traceabilityPathStepContext = ({
  rootSchemaScope,
  path,
  depth,
  relationSchemas
}: {
  rootSchemaScope: TraceabilitySchemaScope;
  path: TraceabilityViewConfig['paths'][number];
  depth: number;
  relationSchemas: RelationSchema[];
}): TraceabilityPathStepContext => {
  let currentSchemaScope = rootSchemaScope;

  for (let index = 0; index < depth; index += 1) {
    const priorStep = path.path[index];
    if (priorStep?.kind !== 'unboundTypedRelation') {
      currentSchemaScope = 'any';
      continue;
    }

    const relation = relationSchemas.find(schema => schema.id === priorStep.relationSchemaId);
    const directions = relation ? traceabilityRelationDirections(relation, currentSchemaScope) : [];
    if (!relation || !directions.includes(priorStep.direction)) {
      currentSchemaScope = 'any';
      continue;
    }

    currentSchemaScope = nextTraceabilitySchemaScope(relation, priorStep.direction);
  }

  const step = path.path[depth];
  const relation =
    step?.kind === 'unboundTypedRelation'
      ? relationSchemas.find(schema => schema.id === step.relationSchemaId)
      : undefined;
  const compatibleDirections = relation
    ? traceabilityRelationDirections(relation, currentSchemaScope)
    : [];

  return {
    currentSchemaScope,
    compatibleRelations: traceabilityCompatibleRelations(relationSchemas, currentSchemaScope),
    compatibleDirections,
    invalid:
      step?.kind !== 'unboundTypedRelation' ||
      relation == null ||
      !compatibleDirections.includes(step.direction)
  };
};

export const buildTraceabilityEntityQuery = (
  query: EntityQuery | null | undefined,
  config: unknown
): { query: EntityQuery | null; aliases: TraceabilityProjectionAliases[] } => {
  const parsed = parseTraceabilityConfig(config);
  if (!parsed) return { query: query ?? null, aliases: [] };

  const aliases = parsed.paths.flatMap(path =>
    path.path.map((_step, index) => ({
      pathId: path.id,
      depth: index,
      id: projectionAlias(path.id, index, 'id'),
      name: projectionAlias(path.id, index, 'name')
    }))
  );
  const baseQuery: EntityQuery = query ?? {
    root: { kind: 'and', children: [] }
  };
  const existingAliases = new Set(
    (baseQuery.projections ?? []).map(projection => projection.alias)
  );
  const projections = aliases.flatMap(alias => {
    const path = parsed.paths.find(candidate => candidate.id === alias.pathId)?.path ?? [];
    const prefix = path.slice(0, alias.depth + 1);
    return [
      ...(existingAliases.has(alias.id) ? [] : [{ path: prefix, fieldId: '_id', alias: alias.id }]),
      ...(existingAliases.has(alias.name)
        ? []
        : [{ path: prefix, fieldId: '_name', alias: alias.name }])
    ];
  });

  return {
    query: { ...baseQuery, projections: [...(baseQuery.projections ?? []), ...projections] },
    aliases
  };
};

export const buildTraceabilityRoots = (
  rows: BrowserEntityRecord[],
  aliases: TraceabilityProjectionAliases[],
  config: unknown
): TraceabilityRoot[] => {
  const parsed = parseTraceabilityConfig(config);
  if (!parsed) return [];

  const aliasesByPath = new Map<string, TraceabilityProjectionAliases[]>();
  for (const alias of aliases) {
    const existing = aliasesByPath.get(alias.pathId) ?? [];
    existing.push(alias);
    aliasesByPath.set(alias.pathId, existing);
  }

  return rows.map(root => {
    const graphNodeIds = new Set([root._uid]);
    const paths = parsed.paths.map(path => {
      const nodes = (aliasesByPath.get(path.id) ?? [])
        .sort((left, right) => left.depth - right.depth)
        .flatMap(alias => {
          const ids = toProjectionValues(root._projections?.[alias.id]);
          const names = toProjectionValues(root._projections?.[alias.name]);
          return ids.map((id, index) => ({ id, name: names[index] ?? id }));
        });
      const uniqueNodes = [...new Map(nodes.map(node => [node.id, node])).values()];
      uniqueNodes.forEach(node => graphNodeIds.add(node.id));
      return { pathId: path.id, label: path.label, nodes: uniqueNodes };
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
      architectureCovered: root.paths.some(path => path.nodes.length > 0),
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
