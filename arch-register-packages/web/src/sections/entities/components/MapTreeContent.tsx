import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import styles from './MapView.module.css';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { MetricConfig, MetricResult } from '@arch-register/api-types/metricContract';
import type { EntityDisplayField } from './entityDisplayFields';
import type { EntityHoverCardRow } from '../../../components/EntityHoverCardBody';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { EmptyState } from '../../../components/EmptyState';
import { EntityTooltip, MetricValueLabel, DuplicateBadge } from './MapTooltip';
import { isRelationMapNode, nodeName, type RenderTreeNode } from './mapViewTraversal';
import type { MapConfig } from './mapViewConfig';

type BoxHandlers = {
  role: 'button';
  tabIndex: 0;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

type MapTreeContentProps = {
  cfg: MapConfig;
  filteredRenderTree: RenderTreeNode[];
  level1Items: TreeNode[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  relationSchemas: RelationSchema[];
  linkedEntityIds?: string[];
  linkedEntityIdSet: Set<string>;
  selectedDisplayFields: EntityDisplayField[];
  metricConfig: MetricConfig | null;
  metricSourceSchema: EntitySchema | RelationSchema | undefined;
  resultsByBoxId: Map<string, MetricResult>;
  lifecycleStates: WorkspaceLifecycleState[];
  boxStyle: (node: TreeNode, isLeaf: boolean) => CSSProperties | undefined;
  nameStyle: (node: TreeNode, dimmed: boolean, isLeaf: boolean) => CSSProperties | undefined;
  metricRowsFor: (node: TreeNode, isLeaf: boolean) => EntityHoverCardRow[];
  boxHandlers: (node: TreeNode) => BoxHandlers;
  detailClick: (publicId: string) => (event: MouseEvent<HTMLButtonElement>) => void;
};

export const MapTreeContent = ({
  cfg,
  filteredRenderTree,
  level1Items,
  schemaMap,
  relationSchemas,
  linkedEntityIds,
  linkedEntityIdSet,
  selectedDisplayFields,
  metricConfig,
  metricSourceSchema,
  resultsByBoxId,
  lifecycleStates,
  boxStyle,
  nameStyle,
  metricRowsFor,
  boxHandlers,
  detailClick
}: MapTreeContentProps) => (
  <div className={styles.scroll}>
    <div
      className={styles.level1Grid}
      style={{
        gridTemplateColumns: `repeat(${cfg.levelConfigs[0]?.columns ?? 3}, 1fr)`
      }}
    >
      {filteredRenderTree.map(entry => {
        const renderEntry = (treeEntry: RenderTreeNode): React.ReactNode => {
          const { node, levelIndex, children } = treeEntry;
          const level = cfg.levelConfigs[levelIndex] ?? { schemaId: null, columns: 3 };
          const entitySchema = schemaMap.get(node._schema.id);
          const relationSchema = relationSchemas.find(
            candidate => candidate.id === node._schema.id
          );
          const color = entitySchema
            ? resolveSchemaColor(entitySchema.schema, entitySchema.index)
            : (relationSchema?.color ?? 'var(--accent-fg)');
          const linkedId = isRelationMapNode(node) ? node._mapRelation.entityId : node._uid;
          const dimmed = linkedEntityIds != null && !linkedEntityIdSet.has(linkedId);
          const childContent =
            children.length > 0 ? (
              <div
                className={styles.childGrid}
                style={{
                  gridTemplateColumns: `repeat(${cfg.levelConfigs[levelIndex + 1]?.columns ?? 3}, 1fr)`
                }}
              >
                {children.map(renderEntry)}
              </div>
            ) : null;

          if (levelIndex > 0 && level.hidden) return childContent;

          const className =
            levelIndex === 0
              ? styles.level1Box
              : levelIndex === 1
                ? styles.level2Box
                : styles.level3Box;
          return (
            <div
              key={node._uid}
              className={`${className} ${styles.focusable}`}
              style={boxStyle(node, children.length === 0)}
              {...boxHandlers(node)}
            >
              <div className={styles.levelHeader}>
                <span className={styles.colorDot} style={{ background: color }} />
                <EntityTooltip
                  node={node}
                  color={color}
                  schemaName={
                    entitySchema?.schema.name ?? relationSchema?.name ?? node._schema.name
                  }
                  isLinked={linkedEntityIds == null || linkedEntityIdSet.has(linkedId)}
                  displayFields={selectedDisplayFields}
                  schemaMap={schemaMap}
                  metricRows={metricRowsFor(node, children.length === 0)}
                >
                  <button
                    type="button"
                    className={styles.entityLink}
                    onClick={detailClick(
                      isRelationMapNode(node) ? node._mapRelation.entityId : node._publicId
                    )}
                    style={nameStyle(node, dimmed, children.length === 0)}
                  >
                    {nodeName(node)}
                  </button>
                </EntityTooltip>
                <MetricValueLabel
                  node={node}
                  isLeaf={children.length === 0}
                  metric={metricConfig}
                  sourceSchema={metricSourceSchema}
                  resultsByBoxId={resultsByBoxId}
                  lifecycleStates={lifecycleStates}
                  style={nameStyle(node, dimmed, children.length === 0)}
                />
                <DuplicateBadge count={resultsByBoxId.get(node._uid)?.duplicateCount} />
              </div>
              {childContent}
            </div>
          );
        };
        return renderEntry(entry);
      })}
    </div>

    {filteredRenderTree.length === 0 && (
      <EmptyState
        title={level1Items.length === 0 ? 'No entities found' : 'No boxes match the metric filters'}
        subtitle="Try adjusting your search or filters."
      />
    )}
  </div>
);
