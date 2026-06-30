import { useMemo, useState } from 'react';
import {
  TbCheck,
  TbChevronDown,
  TbChevronRight,
  TbCopy,
  TbDots,
  TbTrash,
  TbUsers,
  TbX
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { Chip } from '../../../components/Chip';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { StatusChip } from '../../../components/StatusChip';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/api';
import type { TreeNode, WorkspaceTeam } from '../../../lib/api';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type {
  BrowserEntityRecord,
  ProjectBrowserContext,
  ProjectLinkState
} from './entityBrowserState';
import { formatDateValue } from './entityBrowserState';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import styles from '../EntityBrowserScreen.module.css';

type BaseViewProps = {
  rows: BrowserEntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  projectContext?: ProjectBrowserContext;
};

type DateField = Extract<EntitySchema['fields'][number], { type: 'date' }>;

type TableViewProps = BaseViewProps & {
  activeDateField?: DateField | null;
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectRow: (uid: string) => void;
};

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

export type BulkEditToolbarProps = {
  selectedIds: Set<string>;
  bulkConfirming: boolean;
  setBulkConfirming: (value: boolean) => void;
  bulkLifecycleValue: string;
  setBulkLifecycleValue: (value: string) => void;
  bulkOwnerValue: string;
  setBulkOwnerValue: (value: string) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  onClear: () => void;
  onConfirm: () => void;
};

const entityName = (entity: EntityRecord) => entity._name || entity._slug;

const entityMenuItems = (
  entity: EntityRecord,
  onClone: (entity: EntityRecord) => void,
  onDelete: (entity: EntityRecord) => void
): MenuItem[] => {
  const items: MenuItem[] = [];
  if (entity.canCreateChild) {
    items.push({ label: 'Clone', icon: <TbCopy size={14} />, onClick: () => onClone(entity) });
  }
  if (entity.canDelete) {
    items.push({
      label: 'Delete',
      icon: <TbTrash size={14} />,
      danger: true,
      onClick: () => onDelete(entity)
    });
  }
  return items;
};

const projectEntityMenuItems = (
  entity: BrowserEntityRecord,
  projectContext: ProjectBrowserContext | undefined
): MenuItem[] => {
  if (!projectContext?.project.canEdit || entity._projectLink?.linked !== true) {
    return [];
  }

  return [
    {
      label: 'Plan future change',
      icon: <TbCheck size={14} />,
      onClick: () => projectContext.onPlanFutureChange(entity._uid)
    },
    {
      label: entity._projectLink.isDone ? 'Mark not done' : 'Mark done',
      icon: <TbCheck size={14} />,
      onClick: () => projectContext.onToggleDone(entity._uid, entity._projectLink?.isDone ?? false)
    },
    {
      label: 'Remove from project',
      icon: <TbTrash size={14} />,
      danger: true,
      onClick: () => projectContext.onRemoveEntity(entity._uid)
    }
  ];
};

export const BulkEditToolbar = ({
  selectedIds,
  bulkConfirming,
  setBulkConfirming,
  bulkLifecycleValue,
  setBulkLifecycleValue,
  bulkOwnerValue,
  setBulkOwnerValue,
  lifecycleStates,
  teams,
  onClear,
  onConfirm
}: BulkEditToolbarProps) => (
  <div className={styles.bulkBar + (bulkConfirming ? ` ${styles.bulkBarConfirm}` : '')}>
    {!bulkConfirming ? (
      <>
        <span className={styles.bulkCount}>
          <span className={styles.bulkCountPill}>
            <TbCheck size={9} />
            <span>{selectedIds.size}</span>
          </span>
          <span className={styles.bulkCountLabel}>
            {selectedIds.size === 1 ? 'entity' : 'entities'} selected
          </span>
        </span>

        <div className={styles.bulkSep} />

        <label className={styles.bulkField}>
          <span className={styles.bulkFieldLabel}>Set lifecycle</span>
          <Select.Root
            value={bulkLifecycleValue}
            placeholder="No Change"
            onChange={v => setBulkLifecycleValue(v ?? '')}
          >
            {lifecycleStates.map(s => (
              <Select.Item key={s.id} value={s.id}>
                {s.label}
              </Select.Item>
            ))}
          </Select.Root>
        </label>

        <div className={styles.bulkSep} />

        <label className={styles.bulkField}>
          <span className={styles.bulkFieldLabel}>Reassign owner</span>
          <Select.Root
            value={bulkOwnerValue}
            placeholder="No Change"
            onChange={v => setBulkOwnerValue(v ?? '')}
          >
            {teams.map(t => (
              <Select.Item key={t.id} value={t.id}>
                {t.name}
              </Select.Item>
            ))}
          </Select.Root>
        </label>

        <div style={{ flex: 1 }} />

        {(bulkLifecycleValue || bulkOwnerValue) && (
          <Button size="sm" variant="primary" onClick={() => setBulkConfirming(true)}>
            Review changes
          </Button>
        )}

        <Button size="sm" variant="secondary" onClick={onClear}>
          <TbX size={11} />
          <span>Clear</span>
        </Button>
      </>
    ) : (
      <>
        <div className={styles.bulkConfirmMsg}>
          <span className={styles.bulkWarnIcon}>!</span>
          <span>
            {bulkLifecycleValue && (
              <>
                <span className={styles.bulkDim}>Set lifecycle →</span>{' '}
                <b>
                  {lifecycleStates.find(s => s.id === bulkLifecycleValue)?.label ??
                    bulkLifecycleValue}
                </b>
              </>
            )}
            {bulkLifecycleValue && bulkOwnerValue && <span className={styles.bulkDim}> · </span>}
            {bulkOwnerValue && (
              <>
                <span className={styles.bulkDim}>Reassign owner →</span> <b>{bulkOwnerValue}</b>
              </>
            )}
            <span className={styles.bulkDim}> for </span>
            <b>{selectedIds.size}</b>
            <span className={styles.bulkDim}>
              {' '}
              {selectedIds.size === 1 ? 'entity' : 'entities'}
            </span>
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="primary" onClick={onConfirm}>
          Confirm
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkConfirming(false)}>
          Cancel
        </Button>
      </>
    )}
  </div>
);

export const TableView = ({
  rows,
  schemaMap,
  activeDateField,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  projectContext,
  selectedIds,
  onSelectAll,
  onSelectRow
}: TableViewProps) => {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={allSelected}
                ref={el => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={onSelectAll}
              />
            </th>
            <th style={{ minWidth: 200 }}>Name</th>
            <th>Type</th>
            <th>Owner</th>
            <th>Status</th>
            {projectContext && <th>Role</th>}
            {activeDateField && <th>{activeDateField.name}</th>}
            <th style={{ width: 80 }}>NS</th>
            <th style={{ width: 80 }} />
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map(entity => {
            const schemaEntry = schemaMap.get(entity._schema.id);
            const menuItems = [
              ...entityMenuItems(entity, onClone, onDelete),
              ...projectEntityMenuItems(entity, projectContext)
            ];

            return (
              <tr
                key={entity._uid}
                aria-label={`Entity row: ${entityName(entity)}`}
                className={selectedIds.has(entity._uid) ? styles.tableRowSelected : undefined}
                onClick={() => onEntityClick(entity._publicId)}
              >
                <td onClick={ev => ev.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selectedIds.has(entity._uid)}
                    onChange={() => onSelectRow(entity._uid)}
                  />
                </td>
                <td>
                  <div className={styles.tableName}>
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
                          projectContext && entity._projectLink?.linked === false
                            ? { color: 'var(--base-fg-more-dim)' }
                            : undefined
                        }
                      >
                        {entityName(entity)}
                      </div>
                      {entity._description && (
                        <div className={styles.tableNameSub}>{entity._description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}</td>
                <td>
                  <span className="dim">{entity._owner?.name ?? '—'}</span>
                </td>
                <td>
                  {entity._lifecycle && (
                    <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                  )}
                </td>
                {projectContext && (
                  <td>
                    {entity._projectLink?.entityType?.name ? (
                      <Chip
                        tone="ghost"
                        dot={
                          entity._projectLink.entityType.id
                            ? projectContext.entityTypeColorMap.get(entity._projectLink.entityType.id)
                            : undefined
                        }
                      >
                        {entity._projectLink.entityType.name}
                      </Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                )}
                {activeDateField && (
                  <td>
                    <span className="dim">{formatDateValue(entity[activeDateField.id])}</span>
                  </td>
                )}
                <td>
                  <span className="dim">{entity._namespace}</span>
                </td>
                <td>
                  <CompletenessCell value={entity._completeness} />
                </td>
                <td onClick={ev => ev.stopPropagation()}>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const CardsView = ({
  rows,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  projectContext
}: BaseViewProps) => (
  <div className={styles.cardGrid}>
    {rows.map(entity => {
      const schemaEntry = schemaMap.get(entity._schema.id);
      const color = schemaEntry
        ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
        : 'var(--accent-fg)';
      const menuItems = [
        ...entityMenuItems(entity, onClone, onDelete),
        ...projectEntityMenuItems(entity, projectContext)
      ];

      return (
        <div key={entity._uid} className={styles.card} onClick={() => onEntityClick(entity._publicId)}>
          <span className={styles.cardBar} style={{ background: color }} />
          <div className={styles.cardHead}>
            {schemaEntry && <TypeBadge color={color} name={schemaEntry.schema.name} size={22} />}
            <div className={styles.cardHeadRight}>
              {entity._lifecycle && (
                <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
              )}
              {menuItems.length > 0 && (
                <span onClick={ev => ev.stopPropagation()}>
                  <DropdownMenu
                    trigger={
                      <button type="button" className={styles.dotsBtn}>
                        <TbDots size={14} />
                      </button>
                    }
                    items={menuItems}
                  />
                </span>
              )}
            </div>
          </div>
          <div
            className={styles.cardName}
            style={
              projectContext && entity._projectLink?.linked === false
                ? { color: 'var(--base-fg-more-dim)' }
                : undefined
            }
          >
            {entityName(entity)}
          </div>
          {entity._description && <div className={styles.cardDesc}>{entity._description}</div>}
          <div className={styles.cardMeta}>
            <Chip tone="ghost" icon={<TbUsers size={10} />}>
              {entity._owner?.name ?? '—'}
            </Chip>
            {schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}
            {projectContext && entity._projectLink?.entityType?.name && (
              <Chip
                tone="ghost"
                dot={
                  projectContext.entityTypeColorMap.get(entity._projectLink.entityType.id) ?? undefined
                }
              >
                {entity._projectLink.entityType.name}
              </Chip>
            )}
            {projectContext && entity._projectLink?.linked && (
              <Chip tone="ghost">{entity._projectLink.isDone ? 'Done' : 'Open'}</Chip>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

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
          {entityMenuItems(item as unknown as EntityRecord, onClone, onDelete).length > 0 && (
            <DropdownMenu
              trigger={
                <button type="button" className={styles.dotsBtn}>
                  <TbDots size={14} />
                </button>
              }
              items={entityMenuItems(item as unknown as EntityRecord, onClone, onDelete)}
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

const CompletenessCell = ({ value }: { value: number | null }) => {
  if (value == null) return <span className="dim">—</span>;
  const barColor = value <= 75 ? '#f59e0b' : '#22c55e';

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-block',
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'var(--cmp-border)',
          overflow: 'hidden'
        }}
      >
        <span
          style={{ display: 'block', width: `${value}%`, height: '100%', background: barColor }}
        />
      </span>
      <span className="dim" style={{ fontSize: 11 }}>
        {value}%
      </span>
    </span>
  );
};
