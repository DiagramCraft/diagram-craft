import { useState, useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, useSearch, useLocation } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
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
  TbColumns3,
  TbMap,
  TbVectorTriangle,
  TbPinned,
  TbBookmark,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbArrowsRightLeft
} from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import type { SavedView } from '@arch-register/api-types/viewContract';
import { useSavedViews, useDeleteSavedView, useUpdateSavedView } from '../../hooks/useSavedViews';
import { usePinnedEntities } from '../../hooks/useNotifications';
import { useEntityFacets } from '../../hooks/useEntities';
import {
  useCollections,
  useDeleteCollection,
  useUpdateCollection
} from '../../hooks/useCollections';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { RenameDialog } from '../../components/RenameDialog';
import { SidebarGroupLabel } from '../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { asEntityPublicId, entityDetailRoute } from '../../routes/publicObjectRoutes';
import {
  hasFacetSelection,
  parseConditionsFromSearch,
  parseFacetSelectionFromSearch,
  replaceFacetConditions,
  toSavedViewSearch,
  type BrowserSearch,
  type EntityFacetSelection
} from './components/entityBrowserState';
import { toSavedRelationViewSearch } from '../relations/relationBrowserState';
import type { Collection } from '@arch-register/api-types/collectionContract';
import { BaselineSidebarSection } from '../baselines/BaselineSidebarSection';
import type { EntityBrowserSidebarTab } from '../../routes/searchParams';

const FacetRow = ({
  icon,
  label,
  testId,
  checked,
  onToggle,
  trailing,
  tagColor,
  iconOffset = false
}: {
  icon: ReactNode;
  label: string;
  testId: string;
  checked: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  tagColor?: string;
  iconOffset?: boolean;
}) => (
  <TreeRow
    icon={iconOffset ? <span style={{ transform: 'translateY(-0.5px)' }}>{icon}</span> : icon}
    testId={testId}
    label={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Filter by ${label}`}
          onChange={onToggle}
          onClick={event => event.stopPropagation()}
          style={{ margin: 0 }}
        />
        <span>{label}</span>
      </span>
    }
    active={checked}
    onClick={onToggle}
    trailing={trailing}
    tagColor={tagColor}
  />
);

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
  const { entityId: routeEntityId } = useParams({ strict: false });
  const { pathname } = useLocation();
  const onRelationsRoute = pathname.includes('/entities/relations');
  const { permissions } = useWorkspaceContext();
  const search = useSearch({ strict: false });
  const sidebarTab = search.sidebarTab ?? 'home';

  const activeFacets = useMemo(
    () => parseFacetSelectionFromSearch(search as BrowserSearch),
    [search]
  );

  const { data: facets } = useEntityFacets(workspaceSlug, sidebarTab === 'home');
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    enabled: sidebarTab === 'views'
  });
  const { data: pinnedEntities = [], isLoading: isPinnedEntitiesLoading } = usePinnedEntities(
    workspaceSlug,
    sidebarTab === 'bookmarks'
  );
  const { data: collections = [], isLoading: isCollectionsLoading } = useCollections(
    workspaceSlug,
    undefined,
    { enabled: sidebarTab === 'bookmarks' }
  );
  const deleteViewMutation = useDeleteSavedView(workspaceSlug);
  const updateViewMutation = useUpdateSavedView(workspaceSlug);
  const updateCollectionMutation = useUpdateCollection(workspaceSlug);
  const deleteCollectionMutation = useDeleteCollection(workspaceSlug);
  const [deleteViewTarget, setDeleteViewTarget] = useState<SavedView | null>(null);
  const [renameViewTarget, setRenameViewTarget] = useState<SavedView | null>(null);
  const [viewMenu, setViewMenu] = useState<{ x: number; y: number; view: SavedView } | null>(null);
  const [collectionMenu, setCollectionMenu] = useState<{
    x: number;
    y: number;
    collection: Collection;
  } | null>(null);
  const [renameCollectionTarget, setRenameCollectionTarget] = useState<Collection | null>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<Collection | null>(null);

  const statuses = useMemo(() => {
    const configured = lifecycleStates
      .map(state => ({
        id: state.id as string | null,
        label: state.label,
        color: state.color,
        count: facets?.lifecycle.find(bucket => bucket.value === state.id)?.count ?? 0
      }))
      .filter(state => state.count > 0);
    const unassigned = facets?.lifecycle.find(bucket => bucket.value == null);
    if (unassigned && unassigned.count > 0) {
      configured.push({
        id: null,
        label: 'Unassigned',
        color: 'var(--text-muted)',
        count: unassigned.count
      });
    }
    return configured;
  }, [facets, lifecycleStates]);

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
  const navigateFacetSelection = (selection: EntityFacetSelection) => {
    const conditions = replaceFacetConditions(
      parseConditionsFromSearch(search as BrowserSearch),
      selection
    );
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        sidebarTab,
        viewMode: 'table' as const,
        filters: conditions.length > 0 ? JSON.stringify(conditions) : undefined,
        entityQuery: undefined,
        type: undefined,
        status: undefined,
        owner: undefined,
        viewId: undefined
      })
    });
  };

  const toggleFacet = (kind: 'type' | 'status' | 'owner', value: string | null) => {
    const next: EntityFacetSelection = {
      schemaIds: [...activeFacets.schemaIds],
      lifecycleValues: [...activeFacets.lifecycleValues],
      ownerIds: [...activeFacets.ownerIds]
    };
    if (kind === 'type' && value !== null) {
      next.schemaIds = next.schemaIds.includes(value)
        ? next.schemaIds.filter(item => item !== value)
        : [...next.schemaIds, value];
    }
    if (kind === 'status') {
      next.lifecycleValues = next.lifecycleValues.includes(value)
        ? next.lifecycleValues.filter(item => item !== value)
        : [...next.lifecycleValues, value];
    }
    if (kind === 'owner') {
      next.ownerIds = next.ownerIds.includes(value)
        ? next.ownerIds.filter(item => item !== value)
        : [...next.ownerIds, value];
    }
    navigateFacetSelection(next);
  };

  const clearFacetSelection = () =>
    navigateFacetSelection({
      schemaIds: [],
      lifecycleValues: [],
      ownerIds: []
    });

  const applySavedView = (view: SavedView) => {
    const isRelationView = view.filters.root_kind === 'relation';
    navigate({
      to: isRelationView ? '/$workspaceSlug/entities/relations' : '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: {
        ...(isRelationView ? toSavedRelationViewSearch(view) : toSavedViewSearch(view)),
        sidebarTab: 'views'
        // biome-ignore lint/suspicious/noExplicitAny: bypass
      } as any
    });
  };

  const openCollection = (collection: Collection) => {
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: {
        sidebarTab: 'bookmarks',
        collectionId: collection.id,
        viewMode: 'table'
      }
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
      case 'explore':
        return <TbColumns3 size={12} />;
      case 'map':
        return <TbMap size={12} />;
      case 'graph':
        return <TbVectorTriangle size={12} />;
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
              search: (prev: Record<string, unknown>) => {
                const collectionId =
                  typeof prev.collectionId === 'string' ? prev.collectionId : undefined;
                return {
                  ...prev,
                  sidebarTab: v as EntityBrowserSidebarTab,
                  collectionId: v === 'bookmarks' ? collectionId : undefined
                };
              }
            })
          }
        >
          <Tabs.List>
            <Tabs.Trigger value="home">Home</Tabs.Trigger>
            <Tabs.Trigger value="views">Views</Tabs.Trigger>
            <Tabs.Trigger value="bookmarks">Pinned</Tabs.Trigger>
            <Tabs.Trigger value="baselines">Baselines</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        {(onCollapse || onExpand) && (
          <div className={styles.headerActions}>
            {onExpand && (
              <button
                type="button"
                className={styles.action}
                title="Pin sidebar open"
                onClick={onExpand}
              >
                <TbLayoutSidebarLeftExpand size={14} />
              </button>
            )}
            {onCollapse && (
              <button
                type="button"
                className={styles.action}
                title="Collapse to rail"
                onClick={onCollapse}
              >
                <TbLayoutSidebarLeftCollapse size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.scroll}>
        {sidebarTab === 'home' ? (
          <>
            <TreeRow
              icon={<TbDatabase size={12} />}
              label="All entities"
              testId="entity-filter-all"
              active={!hasFacetSelection(activeFacets) && !onRelationsRoute}
              onClick={clearFacetSelection}
              trailing={<span className="dim mono">{totalEntities}</span>}
            />
            <TreeRow
              icon={<TbArrowsRightLeft size={12} />}
              label="All relations"
              testId="entity-filter-all-relations"
              active={onRelationsRoute}
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/entities/relations',
                  params: { workspaceSlug }
                })
              }
            />
            <SidebarGroupLabel>By type</SidebarGroupLabel>
            {schemas.map((s, i) => (
              <FacetRow
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
                checked={activeFacets.schemaIds.includes(s.id)}
                onToggle={() => toggleFacet('type', s.id)}
                trailing={<span className="dim mono">{s.entity_count}</span>}
                tagColor={resolveSchemaColor(s, i)}
                iconOffset
              />
            ))}
            <SidebarGroupLabel>By status</SidebarGroupLabel>
            {statuses.map(s => {
              return (
                <FacetRow
                  key={s.id ?? 'unassigned'}
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
                  checked={activeFacets.lifecycleValues.includes(s.id)}
                  onToggle={() => toggleFacet('status', s.id)}
                  trailing={<span className="dim mono">{s.count}</span>}
                  iconOffset
                />
              );
            })}
            <SidebarGroupLabel>By owner</SidebarGroupLabel>
            {owners.map(([ownerId, ownerName, count]) => (
              <FacetRow
                key={ownerId ?? 'unassigned'}
                testId={`entity-owner-filter-${ownerName}`}
                icon={
                  <div style={{ marginTop: '2px' }}>
                    <TbUsers size={12} />
                  </div>
                }
                label={ownerName}
                checked={activeFacets.ownerIds.includes(ownerId)}
                onToggle={() => toggleFacet('owner', ownerId)}
                trailing={<span className="dim mono">{count}</span>}
              />
            ))}
          </>
        ) : sidebarTab === 'views' ? (
          <>
            {savedViews.filter(v => v.isAdminView).length > 0 && (
              <>
                <SidebarGroupLabel>Workspace views</SidebarGroupLabel>
                {savedViews
                  .filter(v => v.isAdminView)
                  .map(view => (
                    <TreeRow
                      key={view.id}
                      icon={getViewIcon(view.viewMode)}
                      label={view.name}
                      active={search.viewId === view.id}
                      onClick={() => applySavedView(view)}
                      onContextMenu={e => {
                        if (!permissions.canManageAdminViews) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setViewMenu({ x: e.clientX, y: e.clientY, view });
                      }}
                    />
                  ))}
              </>
            )}
            <SidebarGroupLabel>Saved views</SidebarGroupLabel>
            {savedViews.filter(v => !v.isAdminView).length === 0 && (
              <div className={`${styles.emptyState} dim`}>No saved views yet.</div>
            )}
            {savedViews
              .filter(v => !v.isAdminView)
              .map(view => (
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
        ) : sidebarTab === 'bookmarks' ? (
          <>
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
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
                  active={routeEntityId === entity.entity_public_id}
                  onClick={() =>
                    navigate(
                      entityDetailRoute(workspaceSlug, asEntityPublicId(entity.entity_public_id), {
                        sidebarTab: 'bookmarks'
                      })
                    )
                  }
                  trailing={<TbPinned size={12} className="dim" />}
                  tagColor={color}
                />
              );
            })}
            {(isCollectionsLoading || collections.length > 0) && (
              <>
                <SidebarGroupLabel>Collections</SidebarGroupLabel>
                {isCollectionsLoading && (
                  <div className={`${styles.emptyState} dim`}>Loading collections…</div>
                )}
                {collections.map(collection => (
                  <TreeRow
                    key={collection.id}
                    icon={<TbBookmark size={12} />}
                    label={collection.name}
                    active={search.collectionId === collection.id}
                    onClick={() => openCollection(collection)}
                    onContextMenu={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      setCollectionMenu({ x: event.clientX, y: event.clientY, collection });
                    }}
                    trailing={<span className="dim mono">{collection.entityCount}</span>}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <BaselineSidebarSection workspaceSlug={workspaceSlug} kind="workspace" />
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
        <RenameDialog
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

      {collectionMenu && (
        <ContextMenu.Imperative
          x={collectionMenu.x}
          y={collectionMenu.y}
          onClose={() => setCollectionMenu(null)}
        >
          <Menu.Item
            leftSlot={<TbPencil size={13} />}
            onClick={() => setRenameCollectionTarget(collectionMenu.collection)}
          >
            Rename
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            onClick={() => setDeleteCollectionTarget(collectionMenu.collection)}
          >
            Delete
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      {renameCollectionTarget && (
        <RenameDialog
          open={true}
          currentName={renameCollectionTarget.name}
          entityType="collection"
          onRename={name => {
            updateCollectionMutation.mutate({ id: renameCollectionTarget.id, name });
            setRenameCollectionTarget(null);
          }}
          onCancel={() => setRenameCollectionTarget(null)}
        />
      )}

      <DeleteConfirmationDialog
        open={!!deleteCollectionTarget}
        title="Delete collection?"
        message={
          <>
            The collection <b>{deleteCollectionTarget?.name}</b> will be deleted.
          </>
        }
        detail="Entities in the collection will not be changed."
        confirmLabel="Delete collection"
        onConfirm={() => {
          if (deleteCollectionTarget) {
            deleteCollectionMutation.mutate(deleteCollectionTarget.id);
            if (search.collectionId === deleteCollectionTarget.id) {
              navigate({
                to: '/$workspaceSlug/entities',
                params: { workspaceSlug },
                search: { sidebarTab: 'bookmarks', viewMode: 'table' }
              });
            }
            setDeleteCollectionTarget(null);
          }
        }}
        onCancel={() => setDeleteCollectionTarget(null)}
      />
    </>
  );
};
