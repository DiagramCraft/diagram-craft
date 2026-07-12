import { useMemo, useState } from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import {
  entityMenuItems,
  projectEntityMenuItems
} from './entityBrowserViewShared';
import type {
  ProjectBrowserContext,
  ProjectLinkState
} from './entityBrowserState';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import styles from '../EntityBrowserScreen.module.css';
import { findEntityDisplayField, formatEntityDisplayValue, getDisplayFieldIds, type EntityDisplayField } from './entityDisplayFields';
import { Table } from '../../../components/table/Table';

export type TreeViewProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  projectContext?: ProjectBrowserContext;
  readOnly?: boolean;
  config: unknown;
  displayFields: EntityDisplayField[];
  joinAssessmentId?: string | null;
  responsesByEntity?: Map<string, Record<string, string | number>>;
};

type TreeItem = (TreeNode & { _projectLink?: ProjectLinkState; _assessment?: Record<string, string | number> | null }) & {
  children: TreeItem[];
};

export const TreeView = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  projectContext,
  readOnly, config, displayFields,
  joinAssessmentId,
  responsesByEntity
}: TreeViewProps) => {
  const { treeNodes: nodes, treeEdges: edges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    typeFilter,
    ownerFilter,
    statusFilter,
    joinAssessmentId
  });

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
  const columns = getDisplayFieldIds('tree', config).map(id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' });

  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No entities found</div>
        <div>Try adjusting your search or filters.</div>
      </div>
    );
  }

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell style={{ minWidth: 240 }}>Name</Table.HeaderCell>
          <Table.HeaderCell>Type</Table.HeaderCell>
          {columns
            .filter(c => c.id !== '_description')
            .map(c => (
              <Table.HeaderCell key={c.id}>{c.label}</Table.HeaderCell>
            ))}
          {!readOnly && <Table.HeaderCell style={{ width: 28 }} />}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {roots.map(item => (
          <TreeNodeRow
            key={item._uid}
            item={item}
            depth={0}
            schemaMap={schemaMap}
            onEntityClick={onEntityClick}
            onDelete={onDelete}
            onClone={onClone}
            lifecycleStates={lifecycleStates}
            projectContext={projectContext}
            readOnly={readOnly}
            columns={columns}
            displayFields={displayFields}
          />
        ))}
      </Table.Body>
    </Table.Root>
  );
};

const TreeNodeRow = ({
  item,
  depth,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  projectContext,
  readOnly, columns, displayFields
}: {
  item: TreeItem;
  depth: number;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  projectContext?: ProjectBrowserContext;
  readOnly?: boolean;
  columns: EntityDisplayField[];
  displayFields: EntityDisplayField[];
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const schemaEntry = schemaMap.get(item._schema.id);
  const isAncestor = !item._isMatch;
  const menuItems = readOnly
    ? []
    : [
        ...entityMenuItems(item as unknown as EntityRecord, onClone, onDelete),
        ...projectEntityMenuItems(item, projectContext)
      ];

  return (
    <>
      <Table.Row muted={isAncestor} onClick={() => onEntityClick(item._publicId)}>
        <Table.NameCell
          indentLevel={depth}
          prefix={
            hasChildren ? (
              <button
                type="button"
                className={styles.treeToggle}
                onClick={event => {
                  event.stopPropagation();
                  setExpanded(value => !value);
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
          title={item._name || item._slug}
          titleMuted={!!(projectContext && item._projectLink?.linked === false)}
          subtitle={
            columns.some(c => c.id === '_description') && item._description
              ? item._description
              : undefined
          }
        />
        <Table.Cell>
          {schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}
        </Table.Cell>
        {columns
          .filter(c => c.id !== '_description')
          .map(column => {
            const field =
              findEntityDisplayField(column.id, item, schemaMap, displayFields) ?? column;
            return (
              <Table.Cell key={column.id}>
                <span className="dim">{formatEntityDisplayValue(item, field) ?? '—'}</span>
              </Table.Cell>
            );
          })}
        {!readOnly && (
          <Table.ActionsCell>
            {menuItems.length > 0 && (
              <DropdownMenu trigger={<Table.DotsButton />} items={menuItems} />
            )}
          </Table.ActionsCell>
        )}
      </Table.Row>
      {expanded &&
        item.children.map(child => (
          <TreeNodeRow
            key={child._uid}
            item={child}
            depth={depth + 1}
            schemaMap={schemaMap}
            onEntityClick={onEntityClick}
            onDelete={onDelete}
            onClone={onClone}
            lifecycleStates={lifecycleStates}
            projectContext={projectContext}
            readOnly={readOnly}
            columns={columns}
            displayFields={displayFields}
          />
        ))}
    </>
  );
};
