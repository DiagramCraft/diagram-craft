import { useMemo, useCallback, useEffect, useRef } from 'react';
import styles from './MapView.module.css';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { MetricConfig } from '@arch-register/api-types/metricContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import { EmptyState } from '../../../components/EmptyState';
import { getDisplayFieldIds, type EntityDisplayField } from './entityDisplayFields';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { getChildLevelOptions, getMapSchemaIds, resolveMapTraversalPath } from './mapViewState';
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
import { isRelationMapNode, useMapTraversal, type RenderTreeNode } from './mapViewTraversal';
import { getMapBoxHandlers, getMapDetailClick } from './mapInteractions';
import { normalizeMapConfig, type MapConfig } from './mapViewConfig';
import { addSchemaIdsConstraint } from './entityBrowserState';
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

export const MapView = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  conditions,
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
  const { treeNodes: nodes, treeEdges: edges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    entityQuery: mapEntityQuery,
    typeFilter,
    ownerFilter,
    statusFilter,
    schemaIds: mapEntityQuery ? undefined : schemaIds
  });
  const nodeIds = useMemo(() => nodes.map(node => node._uid), [nodes]);
  const entityRelations = useMultipleEntityRelations(workspaceId, nodeIds);
  useEffect(() => {
    onCountChange?.(nodes.filter(node => node._isMatch).length);
  }, [nodes, onCountChange]);
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

  const rootSchemaId = cfg.levelConfigs[0]?.schemaId ?? null;
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);

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

  const { level1Items, renderTree } = useMapTraversal({
    nodes,
    edges,
    relationSchemas,
    entityRelations,
    cfg
  });

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  // ── Metric configuration ─────────────────────────────────────────────────

  const mapLevelSchemaIds = useMemo(
    () => cfg.levelConfigs.map(level => level.schemaId).filter((id): id is string => id != null),
    [cfg.levelConfigs]
  );
  const mapTraversal = useMemo(
    () => resolveMapTraversalPath(mapLevelSchemaIds, schemas, relationSchemas, getFieldGroupAccess),
    [getFieldGroupAccess, mapLevelSchemaIds, relationSchemas, schemas]
  );
  const mapTraversalPath = mapTraversal.path;
  const mapTraversalError = mapTraversal.error;
  const metricTerminalSchemaId = mapLevelSchemaIds[mapLevelSchemaIds.length - 1] ?? null;
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
        if (hasMissingMetricData(metricConfig, result)) return null;
      }
      return {
        ...entry,
        children: entry.children
          .map(filter)
          .filter((child): child is RenderTreeNode => child !== null)
      };
    };
    return renderTree.map(filter).filter((entry): entry is RenderTreeNode => entry !== null);
  }, [cfg.hideMissingMetricData, metricConfig, renderTree, resultsByBoxId]);

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

  const isUnconfigured = !rootSchemaId;

  return (
    <div className={styles.wrap}>
      <MapConfigControls
        hideToolbar={hideToolbar}
        cfg={cfg}
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
