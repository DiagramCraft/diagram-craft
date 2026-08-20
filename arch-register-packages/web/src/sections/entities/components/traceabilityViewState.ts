import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
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
import {
  addChainProjection,
  chainMatchesTarget,
  decodeChainProjection,
  groupPathStepOptions,
  pathCompatibleRelations,
  pathRelationDirections,
  pathStepContext,
  pathStepKey as pathStepKeyImpl,
  pathStepOptions,
  pruneInvalidPathSteps,
  type PathChain,
  type PathSchemaScope,
  type PathStepContext,
  type PathStepOption
} from './pathBuilder/pathBuilderState';

export const pathStepKey = pathStepKeyImpl;
export const groupTraceabilityOptions = groupPathStepOptions;

export const TRACEABILITY_PROJECTION_PREFIX = '__traceability__';

export type TraceabilityProjectionAliases = {
  pathId: string;
  alias: string;
};

export type TraceabilityChain = PathChain;

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

export type TraceabilitySchemaScope = PathSchemaScope;
export type TraceabilityPathOption = PathStepOption;
export type TraceabilityPathStepContext = PathStepContext;

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

const toChains = decodeChainProjection;

const chainProjectionAlias = (pathId: string) => `${TRACEABILITY_PROJECTION_PREFIX}${pathId}:chain`;

export const parseTraceabilityConfig = (config: unknown): TraceabilityViewConfig | null => {
  const result = traceabilityViewConfigSchema.safeParse(config);
  return result.success ? result.data : null;
};

export const traceabilityRelationDirections = pathRelationDirections;
export const traceabilityCompatibleRelations = pathCompatibleRelations;
export const traceabilityPathOptions = pathStepOptions;

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
}): TraceabilityPathStepContext =>
  pathStepContext({
    rootSchemaScope,
    steps: path.path,
    depth,
    schemas,
    relationSchemas,
    getFieldGroupAccess
  });

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
    const prunedSteps = pruneInvalidPathSteps(path.path, {
      rootSchemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    if (prunedSteps === path.path) return [path];
    changed = true;
    return prunedSteps.length === 0 ? [] : [{ ...path, path: prunedSteps }];
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
  const resultQuery = aliases.reduce((acc, entry) => {
    const path = parsed.paths.find(candidate => candidate.id === entry.pathId)?.path ?? [];
    return addChainProjection(acc, path, entry.alias);
  }, baseQuery);

  return { query: resultQuery, aliases };
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
