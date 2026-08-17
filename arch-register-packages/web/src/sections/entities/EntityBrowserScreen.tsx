import { useMemo, useState, useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import styles from './EntityBrowserScreen.module.css';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { TbPlus, TbDownload, TbUpload, TbDots, TbCheck, TbCopy, TbBookmark } from 'react-icons/tb';
import { useSavedViews, useCreateSavedView, useUpdateSavedView } from '../../hooks/useSavedViews';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCollections } from '../../hooks/useCollections';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import { EntityBrowser, SaveViewDialog } from './components/EntityBrowser';
import { CreateBaselineDialog } from '../baselines/CreateBaselineDialog';
import { buildEntityBaselineScope } from '../baselines/baselineScope';
import {
  buildEntityQueryFromBrowserFilters,
  buildSavedViewPayload,
  getSingleFacetValue,
  hasFacetConditions,
  parseEntityQueryFromSearch,
  parseConditionsFromSearch,
  parseViewConfigs
} from './components/entityBrowserState';
import { exportEntitiesToCSV } from '../../lib/entityCsv';
import { downloadBlob } from '../../lib/browserDownload';
import { baselineContextSearch } from '../baselines/baselineContext';
import { BaselineDetailView } from '../baselines/BaselineDetailView';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/entities');

export const EntityBrowserScreen = () => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, schemas, permissions, openAddEntityDialog } = useWorkspaceContext();
  const search = routeApi.useSearch();
  const workspaceId = workspaceSlug;
  const collectionId = search.collectionId ?? null;
  const baselineId = search.baselineId;
  const [count, setCount] = useState(0);
  const [firstFilteredSchemaId, setFirstFilteredSchemaId] = useState<string | null>(null);
  const [isSavingView, setIsSavingView] = useState(false);
  const [isCreatingBaseline, setIsCreatingBaseline] = useState(false);
  const { data: savedViews = [] } = useSavedViews(workspaceId, {
    enabled: search.sidebarTab === 'views' || search.viewId != null
  });
  const { data: collections = [] } = useCollections(workspaceId, undefined, {
    enabled: search.sidebarTab === 'bookmarks' || collectionId != null
  });
  const createSavedViewMutation = useCreateSavedView(workspaceId);
  const updateSavedViewMutation = useUpdateSavedView(workspaceId);
  const conditions = useMemo(() => parseConditionsFromSearch(search), [search]);
  const entityQuery = useMemo(() => parseEntityQueryFromSearch(search), [search]);
  const typeFilter = useMemo(
    () => entityQuery?.schemaId ?? getSingleFacetValue(conditions, '_schemaId'),
    [conditions, entityQuery]
  );
  const statusFilter = useMemo(() => getSingleFacetValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getSingleFacetValue(conditions, '_owner'), [conditions]);
  const requestedView = search.viewMode ?? 'table';
  const view =
    collectionId && requestedView !== 'table' && requestedView !== 'cards'
      ? 'table'
      : requestedView;
  const asOf = search.asOf;
  const readOnly = !!asOf && !collectionId;
  const q = search.q ?? '';
  const sort = search.sort ?? 'name';
  const viewConfigs = useMemo(() => parseViewConfigs(search.viewConfigs), [search.viewConfigs]);
  const activeSavedView = useMemo(
    () => savedViews.find(savedView => savedView.id === search.viewId) ?? null,
    [savedViews, search.viewId]
  );
  const typeName = collectionId
    ? (collections.find(collection => collection.id === collectionId)?.name ?? 'Collection')
    : typeFilter
      ? (schemas.find(schema => schema.id === typeFilter)?.name ?? 'Entities')
      : hasFacetConditions(conditions)
        ? 'Filtered entities'
        : 'All entities';
  const baselineScope = useMemo(
    () =>
      buildEntityBaselineScope({
        viewId: search.viewId,
        viewName: activeSavedView?.name,
        collectionId,
        collectionName: collections.find(collection => collection.id === collectionId)?.name,
        entityQuery,
        typeFilter,
        conditions,
        joinAssessmentId: search.joinAssessmentId,
        q
      }),
    [
      activeSavedView?.name,
      collectionId,
      collections,
      conditions,
      entityQuery,
      q,
      search.joinAssessmentId,
      search.viewId,
      typeFilter
    ]
  );

  const handleSaveView = async (
    name: string,
    description: string,
    scope: 'workspace' | 'project',
    isAdminView: boolean
  ) => {
    try {
      await createSavedViewMutation.mutateAsync(
        buildSavedViewPayload({
          scope,
          name,
          description,
          isAdminView,
          view: view as BrowserView,
          typeFilter,
          statusFilter,
          ownerFilter,
          q,
          sort,
          conditions,
          entityQuery,
          viewConfigs,
          joinAssessmentId: search.joinAssessmentId ?? null
        })
      );
    } catch {
      // Error handling is done by TanStack Query
    }
  };

  const handleUpdateSavedView = useCallback(async () => {
    if (collectionId || !permissions.canManageViews || activeSavedView == null) return;
    const savedViewPayload = buildSavedViewPayload({
      scope: activeSavedView.scope,
      name: activeSavedView.name,
      description: activeSavedView.description ?? '',
      isAdminView: activeSavedView.isAdminView,
      view: view as BrowserView,
      typeFilter,
      statusFilter,
      ownerFilter,
      q,
      sort,
      conditions,
      entityQuery,
      viewConfigs,
      joinAssessmentId: search.joinAssessmentId ?? null
    });
    try {
      await updateSavedViewMutation.mutateAsync({
        id: activeSavedView.id,
        body: {
          projectScope: activeSavedView.projectScope,
          viewMode: view as BrowserView,
          filters: savedViewPayload.filters,
          config: savedViewPayload.config
        }
      });
    } catch {
      // Error handling is done by TanStack Query
    }
  }, [
    activeSavedView,
    collectionId,
    conditions,
    entityQuery,
    ownerFilter,
    permissions.canManageViews,
    q,
    search.joinAssessmentId,
    sort,
    statusFilter,
    typeFilter,
    updateSavedViewMutation,
    view,
    viewConfigs
  ]);

  const handleExport = useCallback(async () => {
    try {
      const exportQuery = entityQuery
        ? { ...entityQuery }
        : hasFacetConditions(conditions)
          ? buildEntityQueryFromBrowserFilters({
              typeFilter,
              conditions,
              joinAssessmentId: search.joinAssessmentId,
              q
            })
          : null;
      const blob = await exportEntitiesToCSV(workspaceId, {
        ...(exportQuery
          ? { entityQuery: exportQuery }
          : { schemaId: typeFilter, owner: ownerFilter, lifecycle: statusFilter, q, conditions }),
        collectionId,
        asOf
      });

      downloadBlob(blob, `entities-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export entities. Please try again.');
    }
  }, [
    asOf,
    collectionId,
    conditions,
    entityQuery,
    search.joinAssessmentId,
    ownerFilter,
    q,
    statusFilter,
    typeFilter,
    workspaceId
  ]);

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];

    if (permissions.canManageViews && !readOnly && !collectionId) {
      if (activeSavedView != null) {
        items.push({
          label: `Save View (${activeSavedView.name})`,
          icon: <TbCheck size={14} />,
          onClick: handleUpdateSavedView
        });
      }

      items.push({
        label: 'Save View As...',
        icon: <TbCopy size={14} />,
        onClick: () => setIsSavingView(true)
      });
    }

    items.push({
      label: 'Create baseline',
      icon: <TbBookmark size={14} />,
      onClick: () => setIsCreatingBaseline(true)
    });

    items.push({
      label: 'Export CSV',
      icon: <TbDownload size={14} />,
      onClick: handleExport
    });

    if (permissions.canCreateEntities && !readOnly) {
      items.push({
        label: 'Import CSV',
        icon: <TbUpload size={14} />,
        onClick: () =>
          navigate({
            to: '/$workspaceSlug/entities/import',
            params: { workspaceSlug },
            search: typeFilter ? { type: typeFilter } : undefined
          })
      });
    }

    return items;
  }, [
    activeSavedView,
    handleExport,
    handleUpdateSavedView,
    navigate,
    permissions.canCreateEntities,
    permissions.canManageViews,
    collectionId,
    readOnly,
    typeFilter,
    workspaceSlug
  ]);

  if (baselineId) {
    return (
      <BaselineDetailView
        workspaceSlug={workspaceSlug}
        baselineId={baselineId}
        onDeleted={() =>
          navigate({
            to: '/$workspaceSlug/entities',
            params: { workspaceSlug },
            search: (previous: Record<string, unknown>) => ({
              ...previous,
              baselineId: undefined,
              sidebarTab: 'home',
              asOf: undefined,
              asOfIncludeProjects: undefined
            })
          })
        }
      />
    );
  }

  return (
    <div className={`${styles.screen} ${view === 'graph' ? styles.graphMode : ''}`}>
      <div className={styles.header}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
            }
          ]}
          title={typeName}
          titleTestId="entity-browser-title"
          chips={
            <span data-testid="entity-browser-count" className={styles.count}>
              {count}
            </span>
          }
          description="Search, filter, and inspect everything in the IT landscape."
          buttons={
            !readOnly && permissions.canCreateEntities ? (
              <Button
                variant="primary"
                icon={<TbPlus size={12} />}
                onClick={() => openAddEntityDialog(firstFilteredSchemaId)}
              >
                New entity
              </Button>
            ) : undefined
          }
          menu={
            <DropdownMenu
              trigger={<Button aria-label="Entity browser actions" icon={<TbDots size={14} />} />}
              items={menuItems}
            />
          }
        />
      </div>

      <EntityBrowser
        onCountChange={setCount}
        onFirstFilteredSchemaIdChange={setFirstFilteredSchemaId}
      />

      <SaveViewDialog
        open={isSavingView}
        onClose={() => setIsSavingView(false)}
        onSave={handleSaveView}
        showAdminOption={permissions.canManageAdminViews}
      />
      <CreateBaselineDialog
        open={isCreatingBaseline}
        onClose={() => setIsCreatingBaseline(false)}
        workspaceSlug={workspaceSlug}
        scope={baselineScope.scope}
        query={baselineScope.query}
        scopeLabel={baselineScope.label}
        scopeDetail={baselineScope.detail}
        onCreated={baseline =>
          navigate({
            to: '/$workspaceSlug/entities',
            params: { workspaceSlug },
            search: (previous: Record<string, unknown>) => ({
              ...previous,
              ...baselineContextSearch(baseline),
              asOf: undefined,
              asOfIncludeProjects: undefined
            })
          })
        }
      />
    </div>
  );
};
