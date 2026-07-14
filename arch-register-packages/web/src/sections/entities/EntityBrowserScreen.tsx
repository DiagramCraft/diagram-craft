import { useMemo, useState, useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import styles from './EntityBrowserScreen.module.css';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { TbPlus, TbDownload, TbUpload, TbDots, TbCheck, TbCopy } from 'react-icons/tb';
import { useTimelineMarkers } from '../../hooks/useEntities';
import { useSavedViews, useCreateSavedView, useUpdateSavedView } from '../../hooks/useSavedViews';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCollections } from '../../hooks/useCollections';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import { EntityBrowser, SaveViewDialog } from './components/EntityBrowser';
import {
  buildSavedViewPayload,
  getFilterValue,
  parseConditionsFromSearch,
  parseViewConfigs,
  toSavedViewConfig
} from './components/entityBrowserState';
import { exportEntitiesToCSV } from '../../lib/entityCsv';
import { downloadBlob } from '../../lib/browserDownload';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/entities');

export const EntityBrowserScreen = () => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, schemas, permissions, openAddEntityDialog } = useWorkspaceContext();
  const search = routeApi.useSearch();
  const workspaceId = workspaceSlug;
  const collectionId = search.collectionId ?? null;
  const [count, setCount] = useState(0);
  const [isSavingView, setIsSavingView] = useState(false);
  const { data: savedViews = [] } = useSavedViews(workspaceId);
  const { data: collections = [] } = useCollections(workspaceId);
  const { data: timelineMarkers = [] } = useTimelineMarkers(workspaceId);
  const createSavedViewMutation = useCreateSavedView(workspaceId);
  const updateSavedViewMutation = useUpdateSavedView(workspaceId);
  const conditions = useMemo(() => parseConditionsFromSearch(search), [search]);
  const typeFilter = useMemo(() => getFilterValue(conditions, '_schemaId'), [conditions]);
  const statusFilter = useMemo(() => getFilterValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getFilterValue(conditions, '_owner'), [conditions]);
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
      : 'All entities';

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
    try {
      await updateSavedViewMutation.mutateAsync({
        id: activeSavedView.id,
        body: {
          projectScope: activeSavedView.projectScope,
          viewMode: view as BrowserView,
          filters: {
            schemaId: typeFilter,
            status: statusFilter,
            owner: ownerFilter,
            q,
            sort,
            conditions,
            assessmentId: search.joinAssessmentId ?? null
          },
          config: toSavedViewConfig(view as BrowserView, viewConfigs)
        }
      });
    } catch {
      // Error handling is done by TanStack Query
    }
  }, [
    activeSavedView,
    collectionId,
    conditions,
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
      const blob = await exportEntitiesToCSV(workspaceId, {
        schemaId: typeFilter,
        owner: ownerFilter,
        lifecycle: statusFilter,
        q
      });

      downloadBlob(blob, `entities-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export entities. Please try again.');
    }
  }, [ownerFilter, q, statusFilter, typeFilter, workspaceId]);

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

  return (
    <div className={styles.screen}>
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
              <Button variant="primary" icon={<TbPlus size={12} />} onClick={openAddEntityDialog}>
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

      <EntityBrowser onCountChange={setCount} timelineMarkers={timelineMarkers} />

      <SaveViewDialog
        open={isSavingView}
        onClose={() => setIsSavingView(false)}
        onSave={handleSaveView}
        showAdminOption={permissions.canManageAdminViews}
      />
    </div>
  );
};
