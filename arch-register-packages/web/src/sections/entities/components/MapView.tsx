import { useMemo, useCallback, useEffect, useRef } from 'react';
import styles from './MapView.module.css';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { MetricConfig, MetricTraversalStep } from '@arch-register/api-types/metricContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery, PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import { EmptyState } from '../../../components/EmptyState';
import { getDisplayFieldIds, type EntityDisplayField } from './entityDisplayFields';
import {
  useEntities,
  useEntitiesByIdSet,
  useMultipleEntityRelations
} from '../../../hooks/useEntities';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import {
  getChildLevelOptions,
  getMapSchemaIds,
  pathStepToMetricTraversalStep,
  repairMapLevelSchemaIds,
  resolveMapTraversalPath
} from './mapViewState';
import {
  chainMatchesTarget,
  targetSchemaIdsForStep,
  type PathChain,
  type PathSchemaScope
} from './pathBuilder/pathBuilderState';
import {
  getMetricSourceOptions,
  parseMetricConfig,
  isEnumSource,
  sourceKey
} from './mapMetricConfig';
import {
  aggregationLabel,
  buildMetricRows,
  getDirectMetricValue,
  hasMissingMetricData,
  resolveBoxColor
} from './mapMetricPresentation';
import { textColorForFill } from './mapColorScales';
import { useMapMetricRollup } from './useMapMetricRollup';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { MapLegend } from './MapLegend';
import { MapConfigControls } from './MapConfigControls';
import { MapTreeContent } from './MapTreeContent';
import {
  buildMapChainQuery,
  buildTreeFromChains,
  collectMapChainNodeIds,
  decodeMapChainsByRoot,
  isRelationMapNode,
  toTreeNode,
  useMapTraversal,
  type RenderTreeNode
} from './mapViewTraversal';
import { getMapBoxHandlers, getMapDetailClick } from './mapInteractions';
import { normalizeMapConfig, type MapConfig } from './mapViewConfig';
import { addSchemaIdsConstraint, buildEntityQueryFromBrowserFilters } from './entityBrowserState';
export type { MapConfig } from './mapViewConfig';
import type { JoinedAssessmentContext } from './entityFieldSources';
import type { EntityHoverCardRow } from '../../../components/EntityHoverCardBody';
import type { PopoverActions } from '@diagram-craft/app-components/Popover';

type MapViewProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  conditions?: FilterCondition[];
  rootSchemaIds: string[];
  entityQuery?: EntityQuery | null;
  onEntityClick: (entityId: string) => void;
  config: unknown;
  onConfigChange: (cfg: MapConfig) => void;
  linkedEntityIds?: string[];
  hideToolbar?: boolean;
  displayFields: EntityDisplayField[];
  lifecycleStates: WorkspaceLifecycleState[];
  joinAssessmentId?: string | null;
  joinedAssessment?: JoinedAssessmentContext | null;
  onCountChange?: (count: number) => void;
};

// Under chain traversal, the terminal schema comes from the last hop's resolved candidates (or,
// for a single-level map with no hops at all, the root scope) rather than the level's own
// possibly-arbitrary `schemaId` - when that resolves to more than one schema and no explicit
// target was picked, there's no single schema to read fields from, so the metric falls back to
// schema-agnostic fields only (#3040-map).
const resolveMetricTerminalSchemaId = (args: {
  useChainTraversal: boolean;
  fullHopChain: PathStep[] | null;
  lastHopCandidateSchemaIds: string[];
  lastLevelTargetSchemaId: string | null;
  rootSchemaScope: PathSchemaScope;
  legacyTerminalSchemaId: string | null;
}): string | null => {
  const {
    useChainTraversal,
    fullHopChain,
    lastHopCandidateSchemaIds,
    lastLevelTargetSchemaId,
    rootSchemaScope
  } = args;
  if (!useChainTraversal) return args.legacyTerminalSchemaId;
  if (fullHopChain && fullHopChain.length > 0) {
    return lastHopCandidateSchemaIds.length <= 1
      ? (lastHopCandidateSchemaIds[0] ?? null)
      : lastLevelTargetSchemaId;
  }
  if (rootSchemaScope !== 'any' && rootSchemaScope.length === 1) return rootSchemaScope[0]!;
  return null;
};

export const MapView = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  conditions,
  rootSchemaIds,
  entityQuery,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  hideToolbar,
  displayFields,
  lifecycleStates,
  joinAssessmentId,
  joinedAssessment,
  onCountChange
}: MapViewProps) => {
  const { schemas, currencies, enums, teams } = useWorkspaceContext();
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId);
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const cfg = useMemo(() => normalizeMapConfig(config), [config]);
  const schemaIds = useMemo(
    () =>
      getMapSchemaIds(cfg).flatMap(id => {
        if (schemas.some(schema => schema.id === id)) return [id];
        const relationSchema = relationSchemas.find(schema => schema.id === id);
        if (!relationSchema) return [];
        return [
          ...(relationSchema.in.schemaIds === 'any'
            ? schemas.map(schema => schema.id)
            : relationSchema.in.schemaIds),
          ...(relationSchema.out.schemaIds === 'any'
            ? schemas.map(schema => schema.id)
            : relationSchema.out.schemaIds)
        ];
      }),
    [cfg, relationSchemas, schemas]
  );
  const mapEntityQuery = useMemo(
    () => addSchemaIdsConstraint(entityQuery ?? null, schemaIds),
    [entityQuery, schemaIds]
  );

  // The same root-schema-scope concept Traceability uses for its path-builder: not one pinned
  // schema, just whatever the current filter narrows the browser to (or every schema, if nothing
  // narrows it). Threaded into the hop editor and hop-chain resolution below exactly like
  // Traceability threads `rootSchemaScope` through `traceabilityPathStepContext` - Map's levels
  // are the same kind of PathStep chain, just rendered as stacked boxes instead of inline chips.
  const rootSchemaScope: PathSchemaScope = useMemo(
    () => (rootSchemaIds.length > 0 ? rootSchemaIds : 'any'),
    [rootSchemaIds]
  );

  // A map whose whole level chain is expressible as PathSteps (no "relation shown as its own
  // level" entry anywhere) fetches via a correlated chain projection instead of the legacy
  // flat-schema-fetch + client-side containment reassembly. This is what lets a level traverse any
  // relation kind, not just containment/reference, and lets Level 1 stand for "every entity
  // matching the current filter" rather than one pinned schema.
  const useChainTraversal = useMemo(
    () =>
      cfg.levelConfigs.every(
        level => level.schemaId == null || schemas.some(schema => schema.id === level.schemaId)
      ),
    [cfg.levelConfigs, schemas]
  );
  // The chain of hops actually saved so far (levels beyond the first) - stops at the first level
  // that hasn't had its hop resolved yet (a just-added blank level, before the hop editor's own
  // auto-pick-and-persist effect catches up one render later), rather than guessing a default here
  // too - that duplicate guessing is exactly what previously drifted out of sync with what the hop
  // editor displayed (#3040-map).
  const fullHopChain = useMemo(() => {
    if (!useChainTraversal) return null;
    const steps: PathStep[] = [];
    for (const level of cfg.levelConfigs.slice(1)) {
      if (!level.step) break;
      steps.push(level.step);
    }
    return steps;
  }, [cfg.levelConfigs, useChainTraversal]);

  // The last hop's own candidate target schemas (e.g. an 'any'-endpoint relation resolves to
  // several) - when there's more than one, the last level's `targetSchemaId` (set via the hop
  // editor's target-schema dropdown, mirroring Traceability's per-path target) both filters
  // matched chains down to that schema and picks which schema's fields the metric can use.
  // Left unset ("any"), results keep every candidate schema and the metric only offers
  // schema-agnostic fields (lifecycle, assessment) - there's no single schema to read from.
  const lastHopCandidateSchemaIds = useMemo(() => {
    const lastStep = fullHopChain?.at(-1);
    return lastStep ? targetSchemaIdsForStep(lastStep, schemas, relationSchemas) : [];
  }, [fullHopChain, schemas, relationSchemas]);
  const lastLevelTargetSchemaId = cfg.levelConfigs.at(-1)?.targetSchemaId ?? null;
  const lastHopTargetFilter: 'any' | string[] =
    lastHopCandidateSchemaIds.length > 1 && lastLevelTargetSchemaId
      ? [lastLevelTargetSchemaId]
      : 'any';

  const { treeNodes: legacyNodes, treeEdges: legacyEdges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    entityQuery: mapEntityQuery,
    typeFilter,
    ownerFilter,
    statusFilter,
    schemaIds,
    treeExpansion: 'both',
    treeDepth: Math.max(0, cfg.levelConfigs.length - 1),
    enabled: !useChainTraversal
  });
  const legacyNodeIds = useMemo(
    () => (useChainTraversal ? [] : legacyNodes.map(node => node._uid)),
    [legacyNodes, useChainTraversal]
  );
  const legacyEntityRelations = useMultipleEntityRelations(workspaceId, legacyNodeIds);

  // MAP_CHAIN_ROOT_LIMIT: the flat entity-list endpoint paginates (default page size 200); the
  // legacy tree endpoint above doesn't, so this is set generously higher to avoid silently
  // truncating a large map's roots.
  const MAP_CHAIN_ROOT_LIMIT = 2000;
  // Whenever an `entityQuery` is present on the request, the server compiles that query
  // exclusively and ignores the simple `schemaId`/`owner`/`lifecycle`/`q` options entirely (see
  // `listEntitiesWithCount`) - so since the chain projection can only live inside an `entityQuery`,
  // every active simple filter has to be folded into it here, or it's silently dropped rather than
  // narrowing the roots.
  const chainRootEntityQuery = useMemo((): EntityQuery => {
    if (entityQuery) return entityQuery;
    const built = buildEntityQueryFromBrowserFilters({
      typeFilter,
      conditions: conditions ?? [],
      joinAssessmentId,
      q
    });
    const extra: QueryNode[] = [];
    if (ownerFilter) {
      extra.push({
        kind: 'predicate',
        path: [],
        fieldId: '_owner',
        op: 'equals',
        value: ownerFilter
      });
    }
    if (statusFilter) {
      extra.push({
        kind: 'predicate',
        path: [],
        fieldId: '_lifecycle',
        op: 'equals',
        value: statusFilter
      });
    }
    return extra.length === 0
      ? built
      : { ...built, root: { kind: 'and', children: [built.root, ...extra] } };
  }, [entityQuery, typeFilter, conditions, joinAssessmentId, q, ownerFilter, statusFilter]);
  const chainQuery = useMemo(
    () => buildMapChainQuery(chainRootEntityQuery, fullHopChain ?? []),
    [chainRootEntityQuery, fullHopChain]
  );
  const chainRoots = useEntities(
    workspaceId,
    {
      view: 'full',
      entityQuery: chainQuery.query,
      assessmentId: chainQuery.query.assessmentId ?? joinAssessmentId,
      projectId,
      projectScope: projectId ? projectScope : undefined,
      limit: MAP_CHAIN_ROOT_LIMIT
    },
    { enabled: useChainTraversal }
  );
  const chainsByRootId = useMemo(() => {
    const decoded = decodeMapChainsByRoot(chainRoots.data);
    if (lastHopTargetFilter === 'any') return decoded;
    const filtered = new Map<string, PathChain[]>();
    for (const [rootId, chains] of decoded) {
      filtered.set(
        rootId,
        chains.filter(chain => chainMatchesTarget(chain, lastHopTargetFilter))
      );
    }
    return filtered;
  }, [chainRoots.data, lastHopTargetFilter]);
  const chainNodeIds = useMemo(() => collectMapChainNodeIds(chainsByRootId), [chainsByRootId]);
  const chainNodeById = useEntitiesByIdSet(workspaceId, chainNodeIds, {
    enabled: useChainTraversal
  });

  const nodes = useChainTraversal ? chainRoots.data : legacyNodes;
  useEffect(() => {
    onCountChange?.(useChainTraversal ? nodes.length : nodes.filter(node => node._isMatch).length);
  }, [nodes, onCountChange, useChainTraversal]);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  const selectedDisplayFields = getDisplayFieldIds('map', cfg).map(
    id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' }
  );

  const notify = useCallback(
    (patch: Partial<MapConfig>) => {
      onConfigChange({ ...cfg, ...patch });
    },
    [cfg, onConfigChange]
  );

  // Self-heals a saved config left with a level's `step` but no `schemaId` by an earlier version
  // of the hop editor (#3040-map), so an already-broken saved view recovers automatically instead
  // of needing every affected level manually re-picked.
  useEffect(() => {
    if (hideToolbar) return;
    const repaired = repairMapLevelSchemaIds(cfg.levelConfigs, schemas, relationSchemas);
    if (repaired !== cfg.levelConfigs) notify({ levelConfigs: repaired });
  }, [hideToolbar, cfg.levelConfigs, schemas, relationSchemas, notify]);

  const rootSchemaId = cfg.levelConfigs[0]?.schemaId ?? null;

  const levelSchemaOptions = useMemo(
    () =>
      cfg.levelConfigs.map((_, index) =>
        index === 0
          ? schemas
          : getChildLevelOptions(
              schemas,
              cfg.levelConfigs[index - 1]?.schemaId ?? null,
              relationSchemas,
              index >= 2 ? cfg.levelConfigs[index - 2]?.schemaId : undefined,
              getFieldGroupAccess
            )
      ),
    [cfg.levelConfigs, getFieldGroupAccess, relationSchemas, schemas]
  );

  const legacyTraversal = useMapTraversal({
    nodes: legacyNodes,
    edges: legacyEdges,
    relationSchemas,
    entityRelations: legacyEntityRelations,
    cfg
  });
  const chainRenderTree = useMemo(
    () =>
      useChainTraversal
        ? buildTreeFromChains(chainRoots.data, chainsByRootId, id => chainNodeById.get(id))
        : [],
    [chainNodeById, chainRoots.data, chainsByRootId, useChainTraversal]
  );
  const level1Items = useChainTraversal
    ? [...chainRoots.data]
        .map(toTreeNode)
        .sort((a, b) => (a._name ?? a._slug).localeCompare(b._name ?? b._slug))
    : legacyTraversal.level1Items;
  const renderTree = useChainTraversal ? chainRenderTree : legacyTraversal.renderTree;

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  // ── Metric configuration ─────────────────────────────────────────────────

  const mapLevelsWithSchema = useMemo(
    () =>
      cfg.levelConfigs.filter(
        (level): level is typeof level & { schemaId: string } => level.schemaId != null
      ),
    [cfg.levelConfigs]
  );
  const mapLevelSchemaIds = useMemo(
    () => mapLevelsWithSchema.map(level => level.schemaId),
    [mapLevelsWithSchema]
  );
  const mapLevelSteps = useMemo(
    () => mapLevelsWithSchema.map(level => level.step),
    [mapLevelsWithSchema]
  );
  const mapTraversal = useMemo(
    () =>
      useChainTraversal
        ? {
            path: (fullHopChain ?? [])
              .map(pathStepToMetricTraversalStep)
              .filter((step): step is MetricTraversalStep => step != null)
          }
        : resolveMapTraversalPath(
            mapLevelSchemaIds,
            schemas,
            relationSchemas,
            getFieldGroupAccess,
            mapLevelSteps
          ),
    [
      fullHopChain,
      getFieldGroupAccess,
      mapLevelSchemaIds,
      mapLevelSteps,
      relationSchemas,
      schemas,
      useChainTraversal
    ]
  );
  const mapTraversalPath = mapTraversal.path;
  const mapTraversalError = 'error' in mapTraversal ? mapTraversal.error : undefined;
  const metricTerminalSchemaId = resolveMetricTerminalSchemaId({
    useChainTraversal,
    fullHopChain,
    lastHopCandidateSchemaIds,
    lastLevelTargetSchemaId,
    rootSchemaScope,
    legacyTerminalSchemaId: cfg.levelConfigs.at(-1)?.schemaId ?? null
  });
  const metricTerminalEntitySchema = metricTerminalSchemaId
    ? schemaMap.get(metricTerminalSchemaId)?.schema
    : undefined;
  const metricTerminalRelationSchema = relationSchemas.find(
    schema => schema.id === metricTerminalSchemaId
  );
  const metricTerminalSchema = metricTerminalEntitySchema ?? metricTerminalRelationSchema;
  const metricTerminalContext: 'entity' | 'relation' = metricTerminalRelationSchema
    ? 'relation'
    : 'entity';
  const storedMetricConfig = useMemo(() => parseMetricConfig(cfg.metricConfig), [cfg.metricConfig]);
  const metricConfig =
    storedMetricConfig && !mapTraversalError
      ? {
          ...storedMetricConfig,
          sourceSchemaId: metricTerminalSchemaId ?? storedMetricConfig.sourceSchemaId,
          sourceContext: metricTerminalContext,
          path: mapTraversalPath.length > 0 ? mapTraversalPath : undefined
        }
      : null;
  const metricSourceSchema = metricTerminalSchema;
  const numeratorConditionPopoverRef = useRef<PopoverActions | null>(null);
  const metricSourceOptions = useMemo(
    () =>
      getMetricSourceOptions(
        metricSourceSchema,
        joinedAssessment,
        getFieldGroupAccess,
        metricTerminalContext
      ),
    [metricSourceSchema, joinedAssessment, getFieldGroupAccess, metricTerminalContext]
  );
  const activeSourceOption = metricConfig
    ? metricSourceOptions.find(o => sourceKey(o.source) === sourceKey(metricConfig.source))
    : undefined;
  const metricLabel = metricConfig
    ? isEnumSource(metricConfig.source)
      ? (activeSourceOption?.label ?? metricConfig.source.kind)
      : `${activeSourceOption?.label ?? metricConfig.source.kind} (${aggregationLabel(metricConfig.aggregation)})`
    : '';

  const setMetricConfig = useCallback(
    (next: MetricConfig | null) => notify({ metricConfig: next ?? undefined }),
    [notify]
  );

  const directMetricRange = useMemo(() => {
    if (!metricConfig || !metricSourceSchema) return { min: null, max: null };
    const values: number[] = [];
    const collect = (entry: RenderTreeNode) => {
      const directValue = getDirectMetricValue(
        entry.node,
        metricConfig,
        metricSourceSchema,
        entry.children.length === 0
      );
      if (directValue?.kind === 'number') values.push(directValue.value);
      entry.children.forEach(collect);
    };
    renderTree.forEach(collect);
    return {
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null
    };
  }, [metricConfig, metricSourceSchema, renderTree]);

  const visibleBoxIds = useMemo(() => {
    const ids: string[] = [];
    const collect = (entry: RenderTreeNode) => {
      const level = cfg.levelConfigs[entry.levelIndex];
      if (!isRelationMapNode(entry.node) && (entry.levelIndex === 0 || !level?.hidden)) {
        ids.push(entry.node._uid);
      }
      entry.children.forEach(collect);
    };
    renderTree.forEach(collect);
    return ids;
  }, [cfg.levelConfigs, renderTree]);

  const {
    resultsByBoxId,
    legend,
    error: metricError
  } = useMapMetricRollup({
    workspaceId,
    boxEntityIds: visibleBoxIds,
    metric: metricConfig,
    schemaId: typeFilter,
    owner: ownerFilter,
    lifecycle: statusFilter,
    q,
    conditions,
    entityQuery,
    assessmentId: joinAssessmentId,
    projectId,
    projectScope
  });

  const filteredRenderTree = useMemo(() => {
    if (!metricConfig || !cfg.hideMissingMetricData) {
      return renderTree;
    }
    const filter = (entry: RenderTreeNode): RenderTreeNode | null => {
      if (!isRelationMapNode(entry.node)) {
        const result = resultsByBoxId.get(entry.node._uid);
        // A leaf box whose own schema matches the metric source (e.g. the System itself carries
        // the budget field being summed) has no *descendants* for the traversal to find, so the
        // aggregate is legitimately empty - `getDirectMetricValue` is the same fallback already
        // used for box color/hover text in this case, so "hide missing" must honor it too, or it
        // hides exactly the boxes that actually have the data (#3040-map).
        const isLeaf = entry.children.length === 0;
        const directValue = getDirectMetricValue(
          entry.node,
          metricConfig,
          metricSourceSchema,
          isLeaf
        );
        if (hasMissingMetricData(metricConfig, result) && directValue == null) return null;
      }
      return {
        ...entry,
        children: entry.children
          .map(filter)
          .filter((child): child is RenderTreeNode => child !== null)
      };
    };
    return renderTree.map(filter).filter((entry): entry is RenderTreeNode => entry !== null);
  }, [cfg.hideMissingMetricData, metricConfig, metricSourceSchema, renderTree, resultsByBoxId]);

  const boxStyle = useCallback(
    (node: TreeNode, isLeaf: boolean): React.CSSProperties | undefined => {
      const color = resolveBoxColor(
        node,
        metricConfig,
        resultsByBoxId,
        legend,
        lifecycleStates,
        metricSourceSchema,
        isLeaf,
        directMetricRange
      );
      if (!color) return undefined;
      return { background: color };
    },
    [metricConfig, resultsByBoxId, legend, lifecycleStates, metricSourceSchema, directMetricRange]
  );

  const nameStyle = useCallback(
    (node: TreeNode, dimmed: boolean, isLeaf: boolean): React.CSSProperties | undefined => {
      if (dimmed) return { color: 'var(--base-fg-more-dim)' };
      const color = resolveBoxColor(
        node,
        metricConfig,
        resultsByBoxId,
        legend,
        lifecycleStates,
        metricSourceSchema,
        isLeaf,
        directMetricRange
      );
      return color ? { color: textColorForFill(color) } : undefined;
    },
    [metricConfig, resultsByBoxId, legend, lifecycleStates, metricSourceSchema, directMetricRange]
  );

  const metricRowsFor = useCallback(
    (node: TreeNode, isLeaf: boolean): EntityHoverCardRow[] =>
      buildMetricRows(
        node,
        isLeaf,
        metricConfig,
        metricLabel,
        activeSourceOption?.label ?? metricConfig?.source.kind ?? '',
        resultsByBoxId,
        lifecycleStates,
        metricSourceSchema
      ),
    [
      metricConfig,
      metricLabel,
      activeSourceOption?.label,
      resultsByBoxId,
      lifecycleStates,
      metricSourceSchema
    ]
  );

  const boxHandlers = useCallback(
    (node: TreeNode) => getMapBoxHandlers(node, onEntityClick),
    [onEntityClick]
  );

  const detailClick = useCallback(
    (publicId: string) => getMapDetailClick(publicId, onEntityClick),
    [onEntityClick]
  );

  // Level 1 no longer requires a pinned schema once the whole level chain can traverse via
  // PathSteps (chain traversal) - it stands for "every entity matching the current filter".
  // Only the legacy relation-as-level path still requires an explicit Level 1 schema.
  const isUnconfigured = !useChainTraversal && !rootSchemaId;

  return (
    <div className={styles.wrap}>
      <MapConfigControls
        hideToolbar={hideToolbar}
        cfg={cfg}
        schemas={schemas}
        relationSchemas={relationSchemas}
        rootSchemaScope={rootSchemaScope}
        useChainTraversal={useChainTraversal}
        levelSchemaOptions={levelSchemaOptions}
        notify={notify}
        metricTerminalSchema={metricTerminalSchema}
        metricTerminalSchemaId={metricTerminalSchemaId}
        metricTerminalEntitySchema={metricTerminalEntitySchema}
        metricTerminalContext={metricTerminalContext}
        mapTraversalPath={mapTraversalPath}
        mapTraversalError={mapTraversalError}
        metricConfig={metricConfig}
        setMetricConfig={setMetricConfig}
        metricSourceSchema={metricSourceSchema}
        metricSourceOptions={metricSourceOptions}
        currencies={currencies}
        teams={teams}
        enums={enums}
        lifecycleStates={lifecycleStates}
        getFieldGroupAccess={getFieldGroupAccess}
        numeratorConditionPopoverRef={numeratorConditionPopoverRef}
      />

      {isUnconfigured ? (
        <EmptyState
          title="Select a schema for Level 1"
          subtitle="Use the controls above to choose which entity types to display at each level."
        />
      ) : (
        <MapTreeContent
          cfg={cfg}
          filteredRenderTree={filteredRenderTree}
          level1Items={level1Items}
          schemaMap={schemaMap}
          relationSchemas={relationSchemas}
          linkedEntityIds={linkedEntityIds}
          linkedEntityIdSet={linkedEntityIdSet}
          selectedDisplayFields={selectedDisplayFields}
          metricConfig={metricConfig}
          metricSourceSchema={metricSourceSchema}
          resultsByBoxId={resultsByBoxId}
          lifecycleStates={lifecycleStates}
          boxStyle={boxStyle}
          nameStyle={nameStyle}
          metricRowsFor={metricRowsFor}
          boxHandlers={boxHandlers}
          detailClick={detailClick}
        />
      )}

      {metricConfig &&
        (metricError ? (
          <div className={styles.metricError}>{metricError.message}</div>
        ) : (
          <MapLegend
            metricLabel={metricLabel}
            source={metricConfig.source}
            aggregation={metricConfig.aggregation}
            legend={legend}
            lifecycleStates={lifecycleStates}
          />
        ))}
    </div>
  );
};
