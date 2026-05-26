import { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './EntityBrowser.module.css';
import { TypeBadge } from '../components/TypeBadge';
import { StatusChip } from '../components/StatusChip';
import { Chip } from '../components/Chip';
import {
  TbSearch, TbDownload, TbPlus, TbList, TbLayoutGrid, TbBinaryTree2,
  TbChevronDown, TbChevronRight, TbDots, TbUsers, TbCopy, TbTrash,
} from 'react-icons/tb';
import type { NavigateFn } from '../routing';
import { fetchEntities, fetchEntityFacets, fetchEntityTree, resolveSchemaColor, exportEntitiesToCSV, deleteEntity, cloneEntity } from '../api';
import type { EntityRecord, EntityFacets, EntitySchema, WorkspaceLifecycleState, TreeNode, TreeEdge } from '../api';
import { DropdownMenu } from '../components/DropdownMenu';

type BrowserView = 'table' | 'cards' | 'tree';

type EntityBrowserProps = {
  workspaceId: string;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  typeFilter: string | null;
  statusFilter: string | null;
  ownerFilter: string | null;
  navigate: NavigateFn;
  onAddEntity?: () => void;
};

export const EntityBrowser = ({ workspaceId, schemas, lifecycleStates, typeFilter, statusFilter, ownerFilter, navigate, onAddEntity }: EntityBrowserProps) => {
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [facets, setFacets] = useState<EntityFacets | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [treeEdges, setTreeEdges] = useState<TreeEdge[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [view, setView] = useState<BrowserView>('table');

  const refreshEntities = useCallback(() => {
    fetchEntities(workspaceId, {
      schemaId: typeFilter,
      owner: ownerFilter,
      lifecycle: statusFilter,
      q,
      view: 'summary',
    }).then(setEntities).catch(() => setEntities([]));
  }, [workspaceId, typeFilter, ownerFilter, statusFilter, q]);

  const refreshTree = useCallback(() => {
    fetchEntityTree(workspaceId, {
      schemaId: typeFilter,
      owner: ownerFilter,
      lifecycle: statusFilter,
      q,
    }).then(r => {
      setTreeNodes(r.nodes);
      setTreeEdges(r.edges);
    }).catch(() => {
      setTreeNodes([]);
      setTreeEdges([]);
    });
  }, [workspaceId, typeFilter, ownerFilter, statusFilter, q]);

  const refreshFacets = useCallback(() => {
    fetchEntityFacets(workspaceId).then(setFacets).catch(() => setFacets(null));
  }, [workspaceId]);

  useEffect(() => {
    refreshEntities();
  }, [refreshEntities]);

  useEffect(() => {
    if (view !== 'tree') return;
    refreshTree();
  }, [refreshTree, view]);

  useEffect(() => {
    refreshFacets();
  }, [refreshFacets]);

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  const owners = useMemo(() => {
    return (facets?.owner ?? [])
      .map(bucket => bucket.value)
      .filter((value): value is string => value != null && value !== '')
      .sort();
  }, [facets]);

  const filtered = useMemo(() => {
    const xs = entities.slice();
    if (sort === 'name') xs.sort((a, b) => (a._name ?? a._slug).localeCompare(b._name ?? b._slug));
    if (sort === 'type') xs.sort((a, b) => a._schemaId.localeCompare(b._schemaId));
    if (sort === 'owner') xs.sort((a, b) => (a._owner ?? '').localeCompare(b._owner ?? ''));
    return xs;
  }, [entities, sort]);

  const setStatusFilter = (v: string) => navigate({ statusFilter: v || null });
  const setOwnerFilter = (v: string) => navigate({ ownerFilter: v || null });

  const handleExport = async () => {
    try {
      const blob = await exportEntitiesToCSV(workspaceId, {
        schemaId: typeFilter,
        owner: ownerFilter,
        lifecycle: statusFilter,
        q,
      });
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entities-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export entities. Please try again.');
    }
  };

  const handleDeleteEntity = async (entity: EntityRecord) => {
    if (!confirm(`Delete "${entity._name || entity._slug}"?`)) return;
    try {
      await deleteEntity(workspaceId, entity._uid);
      refreshEntities();
      refreshFacets();
      if (view === 'tree') refreshTree();
    } catch {
      // ignore
    }
  };

  const handleCloneEntity = async (entity: EntityRecord) => {
    try {
      const cloned = await cloneEntity(workspaceId, entity._uid);
      navigate({ view: 'entity-detail', entityId: cloned._uid });
    } catch {
      // ignore
    }
  };

  const typeName = typeFilter
    ? schemaMap.get(typeFilter)?.schema.name ?? 'Entities'
    : 'All entities';

  const lifecycles = lifecycleStates;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Entities</div>
          <div className={styles.titleRow}>
            <div className={styles.title}>{typeName}</div>
            <span className={styles.count}>{filtered.length}</span>
          </div>
          <div className={styles.sub}>Search, filter, and inspect everything in the IT landscape.</div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={handleExport}><TbDownload size={12} /> Export CSV</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onAddEntity}><TbPlus size={12} /> New entity</button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchInline}>
          <TbSearch size={12} />
          <input
            placeholder="Search by name, owner…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <FilterDropdown
          label="Type"
          value={typeFilter ?? ''}
          onChange={v => navigate({ typeFilter: v || null })}
          options={[
            { value: '', label: 'All types' },
            ...schemas.map(s => ({ value: s.id, label: s.name })),
          ]}
        />
        <FilterDropdown
          label="Status"
          value={statusFilter ?? ''}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'Any' },
            ...lifecycles.map(s => ({ value: s.id, label: s.label })),
          ]}
        />
        <FilterDropdown
          label="Owner"
          value={ownerFilter ?? ''}
          onChange={setOwnerFilter}
          options={[
            { value: '', label: 'Any' },
            ...owners.map(o => ({ value: o, label: o })),
          ]}
        />
        <FilterDropdown
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'name', label: 'Name' },
            { value: 'type', label: 'Type' },
            { value: 'owner', label: 'Owner' },
          ]}
        />

        <div style={{ flex: 1 }} />

        <div className={styles.segmented}>
          <button
            type="button"
            className={view === 'table' ? styles.segmentedActive : ''}
            onClick={() => setView('table')}
            title="Table"
          >
            <TbList size={13} />
          </button>
          <button
            type="button"
            className={view === 'cards' ? styles.segmentedActive : ''}
            onClick={() => setView('cards')}
            title="Cards"
          >
            <TbLayoutGrid size={13} />
          </button>
          <button
            type="button"
            className={view === 'tree' ? styles.segmentedActive : ''}
            onClick={() => setView('tree')}
            title="Tree"
          >
            <TbBinaryTree2 size={13} />
          </button>
        </div>
      </div>

      {view === 'tree' ? (
        treeNodes.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No entities found</div>
            <div>Try adjusting your search or filters.</div>
          </div>
        ) : (
          <TreeView nodes={treeNodes} edges={treeEdges} schemaMap={schemaMap} navigate={navigate} onDelete={handleDeleteEntity} onClone={handleCloneEntity} />
        )
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No entities found</div>
          <div>Try adjusting your search or filters.</div>
        </div>
      ) : (
        <>
          {view === 'table' && <TableView rows={filtered} schemaMap={schemaMap} navigate={navigate} onDelete={handleDeleteEntity} onClone={handleCloneEntity} />}
          {view === 'cards' && <CardsView rows={filtered} schemaMap={schemaMap} navigate={navigate} onDelete={handleDeleteEntity} onClone={handleCloneEntity} />}
        </>
      )}
    </div>
  );
};

const FilterDropdown = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <label className={styles.filter}>
    <span className={styles.filterLabel}>{label}</span>
    <select
      className={styles.filterSelect}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <TbChevronDown size={10} />
  </label>
);

type ViewProps = {
  rows: EntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  navigate: NavigateFn;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
};

const entityName = (e: EntityRecord) => e._name || e._slug;

const TableView = ({ rows, schemaMap, navigate, onDelete, onClone }: ViewProps) => (
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
        {rows.map(e => {
          const s = schemaMap.get(e._schemaId);
          return (
            <tr
              key={e._uid}
              onClick={() => navigate({ view: 'entity-detail', entityId: e._uid })}
            >
              <td>
                <div className={styles.tableName}>
                  {s && <TypeBadge color={resolveSchemaColor(s.schema, s.index)} name={s.schema.name} icon={s.schema.icon} size={18} />}
                  <div>
                    <div className={styles.tableNameMain}>{entityName(e)}</div>
                    {e._description && <div className={styles.tableNameSub}>{e._description}</div>}
                  </div>
                </div>
              </td>
              <td>{s && <Chip tone="ghost">{s.schema.name}</Chip>}</td>
              <td><span className="dim">{e._owner ?? '—'}</span></td>
              <td>{e._lifecycle && <StatusChip value={e._lifecycle} />}</td>
              <td><span className="dim">{e._namespace}</span></td>
              <td onClick={ev => ev.stopPropagation()}>
                <DropdownMenu
                  trigger={<button type="button" className={styles.dotsBtn}><TbDots size={14} /></button>}
                  items={[
                    { label: 'Clone', icon: <TbCopy size={14} />, onClick: () => onClone(e) },
                    { label: 'Delete', icon: <TbTrash size={14} />, danger: true, onClick: () => onDelete(e) },
                  ]}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const CardsView = ({ rows, schemaMap, navigate, onDelete, onClone }: ViewProps) => (
  <div className={styles.cardGrid}>
    {rows.map(e => {
      const s = schemaMap.get(e._schemaId);
      const color = s ? resolveSchemaColor(s.schema, s.index) : 'var(--accent)';
      return (
        <div
          key={e._uid}
          className={styles.card}
          onClick={() => navigate({ view: 'entity-detail', entityId: e._uid })}
        >
          <span className={styles.cardBar} style={{ background: color }} />
          <div className={styles.cardHead}>
            {s && <TypeBadge color={color} name={s.schema.name} size={22} />}
            <div className={styles.cardHeadRight}>
              {e._lifecycle && <StatusChip value={e._lifecycle} />}
              <span onClick={ev => ev.stopPropagation()}>
                <DropdownMenu
                  trigger={<button type="button" className={styles.dotsBtn}><TbDots size={14} /></button>}
                  items={[
                    { label: 'Clone', icon: <TbCopy size={14} />, onClick: () => onClone(e) },
                    { label: 'Delete', icon: <TbTrash size={14} />, danger: true, onClick: () => onDelete(e) },
                  ]}
                />
              </span>
            </div>
          </div>
          <div className={styles.cardName}>{entityName(e)}</div>
          {e._description && <div className={styles.cardDesc}>{e._description}</div>}
          <div className={styles.cardMeta}>
            <Chip tone="ghost" icon={<TbUsers size={10} />}>{e._owner ?? '—'}</Chip>
            {s && <Chip tone="ghost">{s.schema.name}</Chip>}
          </div>
        </div>
      );
    })}
  </div>
);

type TreeViewProps = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  navigate: NavigateFn;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
};

type TreeItem = TreeNode & { children: TreeItem[] };

const TreeView = ({ nodes, edges, schemaMap, navigate, onDelete, onClone }: TreeViewProps) => {
  const roots = useMemo(() => {
    const nodeMap = new Map<string, TreeItem>();
    for (const n of nodes) nodeMap.set(n._uid, { ...n, children: [] });

    const childIds = new Set<string>();
    for (const { childId, parentId } of edges) {
      const parent = nodeMap.get(parentId);
      const child = nodeMap.get(childId);
      if (parent && child) {
        parent.children.push(child);
        childIds.add(childId);
      }
    }

    // Sort children alphabetically
    for (const item of nodeMap.values()) {
      item.children.sort((a, b) => (a._name || a._slug).localeCompare(b._name || b._slug));
    }

    // Roots are nodes that are not children of any other node
    return [...nodeMap.values()]
      .filter(n => !childIds.has(n._uid))
      .sort((a, b) => (a._name || a._slug).localeCompare(b._name || b._slug));
  }, [nodes, edges]);

  if (nodes.length === 0) return null;

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
            <TreeNodeRow key={item._uid} item={item} depth={0} schemaMap={schemaMap} navigate={navigate} onDelete={onDelete} onClone={onClone} />
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
  navigate,
  onDelete,
  onClone,
}: {
  item: TreeItem;
  depth: number;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  navigate: NavigateFn;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const s = schemaMap.get(item._schemaId);
  const isAncestor = !item._isMatch;

  return (
    <>
      <tr
        className={isAncestor ? styles.treeRowAncestor : undefined}
        onClick={() => navigate({ view: 'entity-detail', entityId: item._uid })}
      >
        <td>
          <div className={styles.tableName} style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
              <button
                type="button"
                className={styles.treeToggle}
                onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
              >
                {expanded ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
              </button>
            ) : (
              <span className={styles.treeToggleSpacer} />
            )}
            {s && <TypeBadge color={resolveSchemaColor(s.schema, s.index)} name={s.schema.name} icon={s.schema.icon} size={18} />}
            <div>
              <div className={styles.tableNameMain}>{item._name || item._slug}</div>
              {item._description && <div className={styles.tableNameSub}>{item._description}</div>}
            </div>
          </div>
        </td>
        <td>{s && <Chip tone="ghost">{s.schema.name}</Chip>}</td>
        <td><span className="dim">{item._owner ?? '—'}</span></td>
        <td>{item._lifecycle && <StatusChip value={item._lifecycle} />}</td>
        <td><span className="dim">{item._namespace}</span></td>
        <td onClick={ev => ev.stopPropagation()}>
          <DropdownMenu
            trigger={<button type="button" className={styles.dotsBtn}><TbDots size={14} /></button>}
            items={[
              { label: 'Clone', icon: <TbCopy size={14} />, onClick: () => onClone(item as unknown as EntityRecord) },
              { label: 'Delete', icon: <TbTrash size={14} />, danger: true, onClick: () => onDelete(item as unknown as EntityRecord) },
            ]}
          />
        </td>
      </tr>
      {expanded && item.children.map(child => (
        <TreeNodeRow key={child._uid} item={child} depth={depth + 1} schemaMap={schemaMap} navigate={navigate} onDelete={onDelete} onClone={onClone} />
      ))}
    </>
  );
};
