import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import {
  TbDatabase,
  TbUsers,
  TbPencil,
  TbTrash,
  TbList,
  TbLayoutGrid,
  TbBinaryTree2,
  TbChartRadar,
  TbCalendarWeek,
  TbTable,
  TbPinned,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand
} from 'react-icons/tb';
import { EntityFacets, fetchEntityFacets, resolveSchemaColor, SavedView } from '../../lib/api';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { useSavedViews, useDeleteSavedView, useUpdateSavedView } from '../../hooks/useEntities';
import { usePinnedEntities } from '../../hooks/useNotifications';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

const SidebarRenameDialog = ({
  open,
  currentName,
  entityType,
  onRename,
  onCancel
}: {
  open: boolean;
  currentName: string;
  entityType: 'diagram' | 'folder' | 'view';
  onRename: (newName: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      }, 0);
    }
  }, [open, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onRename(trimmed);
  };

  return (
    <Dialog open={open} onClose={onCancel} title={`Rename ${entityType}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--base-fg-more-dim)' }}>Name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              fontSize: 13,
              padding: '6px 8px',
              background: 'var(--base-bg)',
              border: '1px solid var(--cmp-border)',
              borderRadius: 'var(--r)',
              color: 'var(--base-fg)',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className={styles.renameBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.renameBtnPrimary} disabled={!name.trim()}>
            Rename
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export const EntitiesSidebar = ({
  schemas,
  lifecycleStates,
  workspaceSlug,
  onCollapse,
  onExpand
}: {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  workspaceSlug: string;
  onCollapse?: () => void;
  onExpand?: () => void;
}) => {
  const navigate = useNavigate();
  const { entityId: routeEntityId } = useParams({ strict: false }) as { entityId?: string };
  const { permissions } = useWorkspaceContext();
  const search = useSearch({ strict: false }) as {
    type?: string;
    status?: string;
    owner?: string;
    q?: string;
    viewId?: string;
    viewMode?: string;
    radarConfig?: string;
    timelineConfig?: string;
    sidebarTab?: 'filters' | 'views' | 'pinned';
    filters?: string;
    entityId?: string;
  };
  const sidebarTab = search.sidebarTab ?? 'filters';

  // Parse active filters from the filters JSON string
  const activeFilters = useMemo(() => {
    if (!search.filters) return { type: null, status: null, owner: null };
    try {
      const conditions = JSON.parse(search.filters) as FilterCondition[];
      const result = {
        type: null as string | null,
        status: null as string | null,
        owner: null as string | null
      };
      for (const cond of conditions) {
        if (cond.fieldId === '_schemaId' && cond.op === 'equals')
          result.type = cond.value as string;
        if (cond.fieldId === '_lifecycle' && cond.op === 'equals')
          result.status = cond.value as string;
        if (cond.fieldId === '_owner' && cond.op === 'equals') result.owner = cond.value as string;
      }
      return result;
    } catch {
      return { type: null, status: null, owner: null };
    }
  }, [search.filters]);

  const typeFilter = activeFilters.type;
  const statusFilter = activeFilters.status;
  const ownerFilter = activeFilters.owner;

  const [facets, setFacets] = useState<EntityFacets | null>(null);
  const { data: savedViews = [] } = useSavedViews(workspaceSlug);
  const { data: pinnedEntities = [], isLoading: isPinnedEntitiesLoading } =
    usePinnedEntities(workspaceSlug);
  const deleteViewMutation = useDeleteSavedView(workspaceSlug);
  const updateViewMutation = useUpdateSavedView(workspaceSlug);
  const [deleteViewTarget, setDeleteViewTarget] = useState<SavedView | null>(null);
  const [renameViewTarget, setRenameViewTarget] = useState<SavedView | null>(null);
  const [viewMenu, setViewMenu] = useState<{ x: number; y: number; view: SavedView } | null>(null);

  useEffect(() => {
    if (!workspaceSlug) {
      setFacets(null);
      return;
    }
    fetchEntityFacets(workspaceSlug)
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [workspaceSlug]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (facets?.lifecycle ?? []).forEach(bucket => {
      const key = bucket.value ?? 'none';
      counts[key] = bucket.count;
    });
    return counts;
  }, [facets]);

  const owners = useMemo(() => {
    return (facets?.owner ?? [])
      .map(bucket => {
        const id = bucket.value ?? null;
        const name = id == null ? 'Unassigned' : (bucket.label ?? id);
        return [id, name, bucket.count] as const;
      })
      .sort((a, b) => b[2] - a[2]);
  }, [facets]);

  const totalEntities = facets?.total ?? schemas.reduce((sum, s) => sum + s.entity_count, 0);
  const activeFilterKind =
    typeFilter != null
      ? 'type'
      : statusFilter != null
        ? 'status'
        : ownerFilter != null
          ? 'owner'
          : 'all';

  const navigateEntities = (params: {
    type?: string;
    status?: string;
    owner?: string;
    sidebarTab?: 'filters' | 'views' | 'pinned';
  }) => {
    // Start with a clean search object, only preserving sidebarTab if not explicitly set
    const nextSearch: Record<string, unknown> = {
      sidebarTab: params.sidebarTab ?? sidebarTab
    };

    // If any filter is being set, reset to default list view and clear all other filters
    if (params.type !== undefined || params.status !== undefined || params.owner !== undefined) {
      // Set default list view
      nextSearch.viewMode = 'table';

      // Build filter conditions for only the clicked filter
      const conditions: FilterCondition[] = [];
      if (params.type) conditions.push({ fieldId: '_schemaId', op: 'equals', value: params.type });
      if (params.status)
        conditions.push({ fieldId: '_lifecycle', op: 'equals', value: params.status });
      if (params.owner) conditions.push({ fieldId: '_owner', op: 'equals', value: params.owner });

      if (conditions.length > 0) {
        nextSearch.filters = JSON.stringify(conditions);
      }
      // Don't set type, status, owner in search params - they're in filters
    }

    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: nextSearch
    });
  };

  const applySavedView = (view: SavedView) => {
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: {
        type: view.filters.schemaId ?? undefined,
        status: view.filters.status ?? undefined,
        owner: view.filters.owner ?? undefined,
        q: view.filters.q ?? undefined,
        viewId: view.id,
        viewMode: view.viewMode,
        radarConfig: view.config?.radar ? JSON.stringify(view.config.radar) : undefined,
        timelineConfig: view.config?.timeline ? JSON.stringify(view.config.timeline) : undefined,
        sidebarTab: 'views',
        filters: view.filters.conditions ? JSON.stringify(view.filters.conditions) : undefined
        // biome-ignore lint/suspicious/noExplicitAny: bypass
      } as any
    });
  };

  const getViewIcon = (mode: string) => {
    switch (mode) {
      case 'table':
        return <TbList size={12} />;
      case 'cards':
        return <TbLayoutGrid size={12} />;
      case 'tree':
        return <TbBinaryTree2 size={12} />;
      case 'radar':
        return <TbChartRadar size={12} />;
      case 'timeline':
        return <TbCalendarWeek size={12} />;
      default:
        return <TbTable size={12} />;
    }
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root
          value={sidebarTab}
          onValueChange={v =>
            navigate({
              to: '/$workspaceSlug/entities',
              params: { workspaceSlug },
              search: prev => ({ ...prev, sidebarTab: v as 'filters' | 'views' | 'pinned' })
            })
          }
        >
          <Tabs.List>
            <Tabs.Trigger value="filters">Filters</Tabs.Trigger>
            <Tabs.Trigger value="views">Views</Tabs.Trigger>
            <Tabs.Trigger value="pinned">Pinned</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        {(onCollapse || onExpand) && (
          <div className={styles.headerActions}>
            {onExpand && (
              <button className={styles.action} title="Pin sidebar open" onClick={onExpand}>
                <TbLayoutSidebarLeftExpand size={14} />
              </button>
            )}
            {onCollapse && (
              <button className={styles.action} title="Collapse to rail" onClick={onCollapse}>
                <TbLayoutSidebarLeftCollapse size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.scroll}>
        {sidebarTab === 'filters' ? (
          <>
            <TreeRow
              icon={<TbDatabase size={12} />}
              label="All entities"
              testId="entity-filter-all"
              active={activeFilterKind === 'all'}
              onClick={() =>
                navigateEntities({ type: undefined, status: undefined, owner: undefined })
              }
              trailing={<span className="dim mono">{totalEntities}</span>}
            />
            <GroupLabel>By type</GroupLabel>
            {schemas.map((s, i) => (
              <TreeRow
                key={s.id}
                testId={`entity-type-filter-${s.name}`}
                icon={
                  <TypeBadge
                    color={resolveSchemaColor(s, i)}
                    name={s.name}
                    icon={s.icon}
                    size={14}
                  />
                }
                label={s.name}
                active={activeFilterKind === 'type' && typeFilter === s.id}
                onClick={() =>
                  navigateEntities({ type: s.id, status: undefined, owner: undefined })
                }
                trailing={<span className="dim mono">{s.entity_count}</span>}
                tagColor={resolveSchemaColor(s, i)}
              />
            ))}
            <GroupLabel>By status</GroupLabel>
            {lifecycleStates.map(s => {
              const count = statusCounts[s.id] ?? 0;
              if (!count) return null;
              return (
                <TreeRow
                  key={s.id}
                  testId={`entity-status-filter-${s.label}`}
                  icon={
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: s.color
                      }}
                    />
                  }
                  label={s.label}
                  active={activeFilterKind === 'status' && statusFilter === s.id}
                  onClick={() =>
                    navigateEntities({ type: undefined, status: s.id, owner: undefined })
                  }
                  trailing={<span className="dim mono">{count}</span>}
                />
              );
            })}
            <GroupLabel>By owner</GroupLabel>
            {owners.map(([ownerId, ownerName, count]) => (
              <TreeRow
                key={ownerId ?? 'unassigned'}
                testId={`entity-owner-filter-${ownerName}`}
                icon={<TbUsers size={12} />}
                label={ownerName}
                active={activeFilterKind === 'owner' && ownerFilter === ownerId}
                onClick={() =>
                  navigateEntities({
                    type: undefined,
                    status: undefined,
                    owner: ownerId ?? undefined
                  })
                }
                trailing={<span className="dim mono">{count}</span>}
              />
            ))}
          </>
        ) : sidebarTab === 'views' ? (
          <>
            <GroupLabel>Saved views</GroupLabel>
            {savedViews.length === 0 && (
              <div className={`${styles.emptyState} dim`}>No saved views yet.</div>
            )}
            {savedViews.map(view => (
              <TreeRow
                key={view.id}
                icon={getViewIcon(view.viewMode)}
                label={view.name}
                active={search.viewId === view.id}
                onClick={() => applySavedView(view)}
                onContextMenu={e => {
                  if (!permissions.canManageViews) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setViewMenu({ x: e.clientX, y: e.clientY, view });
                }}
              />
            ))}
          </>
        ) : (
          <>
            <GroupLabel>Pinned entities</GroupLabel>
            {isPinnedEntitiesLoading && (
              <div className={`${styles.emptyState} dim`}>Loading pinned entities…</div>
            )}
            {!isPinnedEntitiesLoading && pinnedEntities.length === 0 && (
              <div className={`${styles.emptyState} dim`}>No pinned entities yet.</div>
            )}
            {pinnedEntities.map(entity => {
              const schemaIndex = schemas.findIndex(schema => schema.id === entity.schema_id);
              const schema = schemas.find(item => item.id === entity.schema_id);
              const color = schema
                ? resolveSchemaColor(schema, Math.max(schemaIndex, 0))
                : 'var(--accent-fg)';
              return (
                <TreeRow
                  key={entity.entity_id}
                  icon={
                    <TypeBadge
                      color={color}
                      name={schema?.name ?? entity.schema_id}
                      icon={schema?.icon ?? null}
                      size={14}
                    />
                  }
                  label={entity.entity_name}
                  active={routeEntityId === entity.entity_id}
                  onClick={() =>
                    navigate({
                      to: '/$workspaceSlug/entities/$entityId',
                      params: { workspaceSlug, entityId: entity.entity_id },
                      search: prev => ({ ...prev, sidebarTab: 'pinned' })
                    })
                  }
                  trailing={<TbPinned size={12} className="dim" />}
                  tagColor={color}
                />
              );
            })}
          </>
        )}
      </div>

      <DeleteConfirmationDialog
        open={!!deleteViewTarget}
        title="Delete view?"
        message={
          <>
            The view <b>{deleteViewTarget?.name}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete view"
        onConfirm={() => {
          if (deleteViewTarget) {
            deleteViewMutation.mutate(deleteViewTarget.id);
            setDeleteViewTarget(null);
          }
        }}
        onCancel={() => setDeleteViewTarget(null)}
      />

      {viewMenu && (
        <ContextMenu.Imperative x={viewMenu.x} y={viewMenu.y} onClose={() => setViewMenu(null)}>
          <Menu.Item
            leftSlot={<TbPencil size={13} />}
            onClick={() => setRenameViewTarget(viewMenu.view)}
          >
            Rename
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            onClick={() => setDeleteViewTarget(viewMenu.view)}
          >
            Delete
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      {renameViewTarget && (
        <SidebarRenameDialog
          open={true}
          currentName={renameViewTarget.name}
          entityType="view"
          onRename={newName => {
            updateViewMutation.mutate({ id: renameViewTarget.id, body: { name: newName } });
            setRenameViewTarget(null);
          }}
          onCancel={() => setRenameViewTarget(null)}
        />
      )}
    </>
  );
};
