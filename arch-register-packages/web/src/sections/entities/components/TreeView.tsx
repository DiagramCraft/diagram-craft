import { useMemo, useState } from 'react';
import { TbChevronDown, TbChevronRight, TbDots } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { StatusChip } from '../../../components/StatusChip';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/api';
import type { TreeNode } from '../../../lib/api';
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
};

type TreeItem = (TreeNode & { _projectLink?: ProjectLinkState }) & { children: TreeItem[] };

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
  projectContext
}: TreeViewProps) => {
  const { treeNodes: nodes, treeEdges: edges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    typeFilter,
    ownerFilter,
    statusFilter
  });

  const roots = useMemo(() => {
    const nodeMap = new Map<string, TreeItem>();
    for (const node of nodes) nodeMap.set(node._uid, { ...node, children: [] });

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
  }, [nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No entities found</div>
        <div>Try adjusting your search or filters.</div>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ minWidth: 240 }}>Name</th>
            <th>Type</th>
            <th>Owner</th>
            <th>Status</th>
            <th style={{ width: 110 }}>Namespace</th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
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
            />
          ))}
        </tbody>
      </table>
    </div>
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
  projectContext
}: {
  item: TreeItem;
  depth: number;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  projectContext?: ProjectBrowserContext;
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const schemaEntry = schemaMap.get(item._schema.id);
  const isAncestor = !item._isMatch;
  const menuItems = [
    ...entityMenuItems(item as unknown as EntityRecord, onClone, onDelete),
    ...projectEntityMenuItems(item, projectContext)
  ];

  return (
    <>
      <tr
        className={isAncestor ? styles.treeRowAncestor : undefined}
        onClick={() => onEntityClick(item._publicId)}
      >
        <td>
          <div className={styles.tableName} style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
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
            )}
            {schemaEntry && (
              <TypeBadge
                color={resolveSchemaColor(schemaEntry.schema, schemaEntry.index)}
                name={schemaEntry.schema.name}
                icon={schemaEntry.schema.icon}
                size={18}
              />
            )}
            <div>
              <div
                className={styles.tableNameMain}
                style={
                  projectContext && item._projectLink?.linked === false
                    ? { color: 'var(--base-fg-more-dim)' }
                    : undefined
                }
              >
                {item._name || item._slug}
              </div>
              {item._description && <div className={styles.tableNameSub}>{item._description}</div>}
            </div>
          </div>
        </td>
        <td>{schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}</td>
        <td>
          <span className="dim">{item._owner?.name ?? '—'}</span>
        </td>
        <td>
          {item._lifecycle && (
            <StatusChip value={item._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
        </td>
        <td>
          <span className="dim">{item._namespace}</span>
        </td>
        <td onClick={event => event.stopPropagation()}>
          {menuItems.length > 0 && (
            <DropdownMenu
              trigger={
                <button type="button" className={styles.dotsBtn}>
                  <TbDots size={14} />
                </button>
              }
              items={menuItems}
            />
          )}
        </td>
      </tr>
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
          />
        ))}
    </>
  );
};
