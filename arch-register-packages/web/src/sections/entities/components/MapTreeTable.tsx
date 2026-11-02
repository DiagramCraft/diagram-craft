import { useMemo, useState, type CSSProperties } from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { MetricConfig, MetricResult } from '@arch-register/api-types/metricContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { Table } from '../../../components/table/Table';
import { TypeBadge } from '../../../components/TypeBadge';
import type { EntityHoverCardRow } from '../../../components/EntityHoverCardBody';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import treeStyles from '../EntityBrowserScreen.module.css';
import mapStyles from './NestedMapView.module.css';
import {
  findEntityDisplayField,
  formatEntityDisplayValue,
  type EntityDisplayField
} from './entityDisplayFields';
import { DuplicateBadge, EntityTooltip, MetricValueLabel } from './MapTooltip';
import {
  flattenVisibleMapRows,
  isRelationMapNode,
  nodeName,
  type RenderTreeNode
} from './mapViewTraversal';
import type { MapConfig } from './mapViewConfig';

type MapTreeTableProps = {
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
  metricLabel: string;
  resultsByBoxId: Map<string, MetricResult>;
  lifecycleStates: WorkspaceLifecycleState[];
  boxStyle: (node: TreeNode, isLeaf: boolean) => CSSProperties | undefined;
  nameStyle: (node: TreeNode, dimmed: boolean, isLeaf: boolean) => CSSProperties | undefined;
  metricRowsFor: (node: TreeNode, isLeaf: boolean) => EntityHoverCardRow[];
  detailClick: (publicId: string) => (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export const MapTreeTable = ({
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
  metricLabel,
  resultsByBoxId,
  lifecycleStates,
  boxStyle,
  nameStyle,
  metricRowsFor,
  detailClick
}: MapTreeTableProps) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(
    () => flattenVisibleMapRows(filteredRenderTree, cfg.levelConfigs, collapsed),
    [filteredRenderTree, cfg.levelConfigs, collapsed]
  );
  const fieldColumns = selectedDisplayFields.filter(f => f.id !== '_description');

  const toggle = (uid: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (!next.delete(uid)) next.add(uid);
      return next;
    });

  if (filteredRenderTree.length === 0) {
    return (
      <EmptyState
        title={level1Items.length === 0 ? 'No entities found' : 'No rows match the metric filters'}
        subtitle="Try adjusting your search or filters."
      />
    );
  }

  return (
    <div className={mapStyles.scroll}>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell style={{ minWidth: 240 }}>Name</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            {fieldColumns.map(f => (
              <Table.HeaderCell key={f.id}>{f.label}</Table.HeaderCell>
            ))}
            {metricConfig && <Table.HeaderCell>{metricLabel}</Table.HeaderCell>}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map(({ entry, depth, hasChildren, isLeaf }) => {
            const { node } = entry;
            const entitySchema = schemaMap.get(node._schema.id);
            const relationSchema = relationSchemas.find(c => c.id === node._schema.id);
            const color = entitySchema
              ? resolveSchemaColor(entitySchema.schema, entitySchema.index)
              : (relationSchema?.color ?? 'var(--accent-fg)');
            const schemaName =
              entitySchema?.schema.name ?? relationSchema?.name ?? node._schema.name;
            const linkedId = isRelationMapNode(node) ? node._mapRelation.entityId : node._uid;
            const dimmed = linkedEntityIds != null && !linkedEntityIdSet.has(linkedId);
            const expanded = !collapsed.has(node._uid);
            return (
              <Table.Row key={node._uid} muted={dimmed}>
                <Table.NameCell
                  indentLevel={depth}
                  prefix={
                    hasChildren ? (
                      <button
                        type="button"
                        className={treeStyles.treeToggle}
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                        aria-expanded={expanded}
                        onClick={() => toggle(node._uid)}
                      >
                        {expanded ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
                      </button>
                    ) : (
                      <span className={treeStyles.treeToggleSpacer} />
                    )
                  }
                  icon={
                    entitySchema && (
                      <TypeBadge
                        color={color}
                        name={entitySchema.schema.name}
                        icon={entitySchema.schema.icon}
                        size={18}
                      />
                    )
                  }
                  title={
                    <EntityTooltip
                      node={node}
                      color={color}
                      schemaName={schemaName}
                      isLinked={!dimmed}
                      displayFields={selectedDisplayFields}
                      schemaMap={schemaMap}
                      metricRows={metricRowsFor(node, isLeaf)}
                    >
                      <button
                        type="button"
                        className={mapStyles.entityLink}
                        onClick={detailClick(
                          isRelationMapNode(node) ? node._mapRelation.entityId : node._publicId
                        )}
                      >
                        {nodeName(node)}
                      </button>
                    </EntityTooltip>
                  }
                />
                <Table.Cell>
                  <Chip tone="ghost">{schemaName}</Chip>
                </Table.Cell>
                {fieldColumns.map(column => {
                  const field =
                    findEntityDisplayField(column.id, node, schemaMap, selectedDisplayFields) ??
                    column;
                  return (
                    <Table.Cell key={column.id}>
                      {formatEntityDisplayValue(node as EntityRecord, field) ?? '—'}
                    </Table.Cell>
                  );
                })}
                {metricConfig && (
                  <Table.Cell style={boxStyle(node, isLeaf)}>
                    <MetricValueLabel
                      node={node}
                      isLeaf={isLeaf}
                      metric={metricConfig}
                      sourceSchema={metricSourceSchema}
                      resultsByBoxId={resultsByBoxId}
                      lifecycleStates={lifecycleStates}
                      style={nameStyle(node, false, isLeaf)}
                    />
                    <DuplicateBadge count={resultsByBoxId.get(node._uid)?.duplicateCount} />
                  </Table.Cell>
                )}
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
