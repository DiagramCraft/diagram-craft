import { useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import styles from './EntityBrowserScreen.module.css';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import {
  TbPlus,
  TbDownload,
  TbUpload,
  TbDots,
  TbCheck,
  TbCopy
} from 'react-icons/tb';
import {
  useSavedViews,
  useCreateSavedView,
  useUpdateSavedView,
  useTimelineMarkers
} from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import {
  EntityBrowser,
  SaveViewDialog
} from './components/EntityBrowser';
import {
  type BrowserSearch,
  buildSavedViewPayload,
  getFilterValue,
  parseConditionsFromSearch,
  parseViewConfigs,
  toSavedViewConfig
} from './components/entityBrowserState';
import { exportEntitiesToCSV } from '../../lib/api';
import { AsOfBanner } from '../../components/AsOfBanner';
import { AsOfTimelinePicker } from '../../components/timeline/AsOfTimelinePicker';

export const EntityBrowserScreen = () => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, permissions, openAddEntityDialog } = useWorkspaceContext();
  const search = useSearch({ strict: false }) as BrowserSearch;
  const workspaceId = workspaceSlug;
  const [count, setCount] = useState(0);
  const [isSavingView, setIsSavingView] = useState(false);
  const { data: savedViews = [] } = useSavedViews(workspaceId);
  const { data: timelineMarkers = [] } = useTimelineMarkers(workspaceId);
  const createSavedViewMutation = useCreateSavedView(workspaceId);
  const updateSavedViewMutation = useUpdateSavedView(workspaceId);
  const conditions = useMemo(() => parseConditionsFromSearch(search), [search]);
  const typeFilter = useMemo(() => getFilterValue(conditions, '_schemaId'), [conditions]);
  const statusFilter = useMemo(() => getFilterValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getFilterValue(conditions, '_owner'), [conditions]);
  const view = search.viewMode ?? 'table';
  const asOf = search.asOf;
  const readOnly = !!asOf;
  const q = search.q ?? '';
  const sort = search.sort ?? 'name';
  const viewConfigs = useMemo(() => parseViewConfigs(search.viewConfigs), [search.viewConfigs]);
  const activeSavedView = useMemo(
    () => savedViews.find(savedView => savedView.id === search.viewId) ?? null,
    [savedViews, search.viewId]
  );
  const typeName = typeFilter
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
          viewConfigs
        })
      );
    } catch {
      // Error handling is done by TanStack Query
    }
  };

  const handleUpdateSavedView = useCallback(async () => {
    if (!permissions.canManageViews || activeSavedView == null) return;
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
            conditions
          },
          config: toSavedViewConfig(view as BrowserView, viewConfigs)
        }
      });
    } catch {
      // Error handling is done by TanStack Query
    }
  }, [
    activeSavedView,
    conditions,
    ownerFilter,
    permissions.canManageViews,
    q,
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
  }, [ownerFilter, q, statusFilter, typeFilter, workspaceId]);

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];

    if (permissions.canManageViews && !readOnly) {
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
    readOnly,
    typeFilter,
    workspaceSlug
  ]);

  const exitSnapshotMode = useCallback(() => {
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: (prev: Record<string, unknown>) => ({ ...prev, asOf: undefined }),
      replace: true
    });
  }, [navigate, workspaceSlug]);

  const handleSelectAsOf = useCallback(
    (date: string) => {
      navigate({
        to: '/$workspaceSlug/entities',
        params: { workspaceSlug },
        search: (prev: Record<string, unknown>) => ({ ...prev, asOf: date }),
        replace: true
      });
    },
    [navigate, workspaceSlug]
  );

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={[{ label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }) }]}
          title={typeName}
          titleTestId="entity-browser-title"
          chips={
            <span data-testid="entity-browser-count" className={styles.count}>
              {count}
            </span>
          }
          description="Search, filter, and inspect everything in the IT landscape."
          buttons={
            !readOnly ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <AsOfTimelinePicker markers={timelineMarkers} onSelect={handleSelectAsOf} />
                {permissions.canCreateEntities && (
                  <Button variant="primary" icon={<TbPlus size={12} />} onClick={openAddEntityDialog}>
                    New entity
                  </Button>
                )}
              </div>
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

      {asOf && <AsOfBanner asOf={asOf} onExit={exitSnapshotMode} />}

      <EntityBrowser onCountChange={setCount} />

      <SaveViewDialog
        open={isSavingView}
        onClose={() => setIsSavingView(false)}
        onSave={handleSaveView}
        showAdminOption={permissions.canManageAdminViews}
      />
    </div>
  );
};
