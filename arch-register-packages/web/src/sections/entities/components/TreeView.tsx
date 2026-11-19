import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '../../../components/table/DataTable';
import { flattenTree, type FlatTreeRow } from './treeFlatten';
import type { TreeItemLike } from './treeFlatten';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { browserEntityMenuItems } from './entityBrowserViewShared';
import { useEntityCommonActions } from './useEntityCommonActions';
import {
  isEntityInProject,
  type ProjectBrowserContext,
  type ProjectLinkState
} from './entityBrowserState';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import styles from '../EntityBrowserScreen.module.css';
import {
  findEntityDisplayField,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  type EntityDisplayField
} from './entityDisplayFields';
import { Table } from '../../../components/table/Table';
import { NameCell } from '../../../components/table/NameCell';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';

export type TreeViewProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  asOf?: string | null;
  includePlannedChanges?: boolean | null;
  conditions?: FilterCondition[];
  entityQuery?: EntityQuery | null;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  onManageCollections?: (entity: EntityRecord) => void;
  onMerge?: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  projectContext?: ProjectBrowserContext;
  readOnly?: boolean;
  config: unknown;
  displayFields: EntityDisplayField[];
  joinAssessmentId?: string | null;
  responsesByEntity?: Map<string, Record<string, string | number | boolean>>;
  onCountChange?: (count: number) => void;
};

type TreeItem = TreeItemLike<
  TreeNode & {
    _projectLink?: ProjectLinkState;
    _assessment?: Record<string, string | number | boolean> | null;
  }
>;

export const TreeView = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  asOf,
  includePlannedChanges,
  conditions,
  entityQuery,
  typeFilter,
  ownerFilter,
  statusFilter,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  onManageCollections,
  onMerge,
  projectContext,
  readOnly,
  config,
  displayFields,
  joinAssessmentId,
  responsesByEntity,
  onCountChange
}: TreeViewProps) => {
  const commonActions = useEntityCommonActions();
  const {
    treeNodes: nodes,
    treeEdges: edges,
    isLoading,
    isError
  } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    conditions,
    asOf,
    includePlannedChanges,
    entityQuery,
    typeFilter,
    ownerFilter,
    statusFilter,
    joinAssessmentId
  });

  useEffect(() => {
    if (isLoading || isError) return;
    onCountChange?.(nodes.filter(node => node._isMatch).length);
  }, [isError, isLoading, nodes, onCountChange]);

  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());

  const roots = useMemo(() => {
    const nodeMap = new Map<string, TreeItem>();
    for (const node of nodes) {
      nodeMap.set(node._uid, {
        ...node,
        _assessment: responsesByEntity?.get(node._uid) ?? null,
        children: []
      });
    }

    const childIds = new Set<string>();
    for (const { childId, parentId } of edges) {
      const parent = nodeMap.get(parentId);
      const child = nodeMap.get(childId);
      if (parent && child) {
        parent.children.push(child);
        childIds.add(childId);
      }
    }

    for (const item of nodeMap.values()) {
      item.children.sort((a, b) => (a._name || a._slug).localeCompare(b._name || b._slug));
    }

    return [...nodeMap.values()]
      .filter(node => !childIds.has(node._uid))
      .sort((a, b) => (a._name || a._slug).localeCompare(b._name || b._slug));
  }, [nodes, edges, responsesByEntity]);
  const flatRows = useMemo(() => flattenTree(roots, collapsedIds), [roots, collapsedIds]);

  const fields = getDisplayFieldIds('tree', config).map(
    id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' }
  );

  if (isLoading) {
    return <LoadingState text="Loading tree…" />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Tree data could not be loaded"
        subtitle="Try again or adjust your search and filters."
      />
    );
  }

  if (nodes.length === 0) {
    return (
      <EmptyState title="No entities found" subtitle="Try adjusting your search or filters." />
    );
  }

  const toggle = (uid: string) =>
    setCollapsedIds(current => {
      const next = new Set(current);
      if (!next.delete(uid)) next.add(uid);
      return next;
    });

  const columns: DataTableColumn<FlatTreeRow<TreeItem>>[] = [
    {
      id: '_name',
      header: 'Name',
      size: 280,
      minSize: 160,
      meta: { label: 'Name', sticky: true, hideable: false },
      cell: ({ row }) => {
        const { item, depth, hasChildren, expanded } = row.original;
        const schemaEntry = schemaMap.get(item._schema.id);
        return (
          <NameCell.Content
            indentLevel={depth}
            prefix={
              hasChildren ? (
                <button
                  type="button"
                  className={styles.treeToggle}
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                  aria-expanded={expanded}
                  onClick={event => {
                    event.stopPropagation();
                    toggle(item._uid);
                  }}
                >
                  {expanded ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
                </button>
              ) : (
                <span className={styles.treeToggleSpacer} />
              )
            }
            icon={
              schemaEntry && (
                <TypeBadge
                  color={resolveSchemaColor(schemaEntry.schema, schemaEntry.index)}
                  name={schemaEntry.schema.name}
                  icon={schemaEntry.schema.icon}
                  size={18}
                />
              )
            }
            title={item._name ?? item._slug}
            titleMuted={
              projectContext != null && !isEntityInProject(item, projectContext.project.id)
            }
            subtitle={
              fields.some(c => c.id === '_description') && item._description
                ? item._description
                : undefined
            }
          />
        );
      }
    },
    {
      id: '_type',
      header: 'Type',
      meta: { label: 'Type' },
      cell: ({ row }) => {
        const schemaEntry = schemaMap.get(row.original.item._schema.id);
        return schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>;
      }
    },
    ...fields
      .filter(c => c.id !== '_description')
      .map(
        (column): DataTableColumn<FlatTreeRow<TreeItem>> => ({
          id: column.id,
          header: column.label,
          meta: { label: column.label },
          cell: ({ row }) => {
            const item = row.original.item;
            const field =
              findEntityDisplayField(column.id, item, schemaMap, displayFields) ?? column;
            return formatEntityDisplayValue(item, field) ?? '—';
          }
        })
      )
  ];

  if (!readOnly) {
    columns.push({
      id: '_actions',
      header: '',
      size: 40,
      meta: { interactive: true, align: 'right', width: 28, selectable: false, hideable: false },
      cell: ({ row }) => {
        const menuItems = browserEntityMenuItems(
          row.original.item,
          { onClone, onDelete, onManageCollections, onMerge, projectContext },
          commonActions
        );
        return menuItems.length > 0 ? (
          <DropdownMenu trigger={<Table.DotsButton />} items={menuItems} />
        ) : null;
      }
    });
  }

  return (
    <DataTable
      // Remount when the configured field set changes so local widths and layout don't leak
      key={columns.map(c => c.id).join('|')}
      scroll
      stickyHeader
      bordered
      resizable
      columns={columns}
      data={flatRows}
      getRowId={row => row.item._uid}
      isRowMuted={row => !row.item._isMatch}
      onRowClick={row => onEntityClick(row.item._publicId)}
    />
  );
};
