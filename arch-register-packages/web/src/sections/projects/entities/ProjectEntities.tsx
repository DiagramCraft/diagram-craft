import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCalendarEvent, TbCheck, TbCopy, TbDots, TbPlus } from 'react-icons/tb';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { useMilestones } from '../../../hooks/useMilestones';
import { useCreateSavedView, useSavedViews, useUpdateSavedView } from '../../../hooks/useSavedViews';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { EntityBrowser, SaveViewDialog } from '../../entities/components/EntityBrowser';
import {
  buildSavedViewPayload,
  getSingleFacetValue,
  parseConditionsFromSearch,
  parseEntityQueryFromSearch,
  parseViewConfigs
} from '../../entities/components/entityBrowserState';
import {
  flattenChangeCaseMembers,
  flattenRelationChangeCaseMembers,
  toMilestonesById
} from '../../entities/components/snapshotDisplay';
import { buildTimelineMarkers } from '../shared/changeCaseTimelineMarkers';
import { ProjectScreenLayout } from '../shared/ProjectScreenLayout';
import styles from './ProjectEntities.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

export const ProjectEntities = ({
  project,
  projectEntities,
  changeCases,
  entityTypeColorMap,
  onNavigateHome,
  onNavigateProject,
  onAddEntity,
  onToggleDone,
  onRemoveEntity,
  onPlanFutureChange,
  onPlanChange
}: {
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  changeCases: ChangeCase[];
  entityTypeColorMap: Map<string, string>;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onAddEntity: () => void;
  onToggleDone: (entityId: string, isDone: boolean) => void;
  onRemoveEntity: (entityId: string) => void;
  onPlanFutureChange: (entityId: string) => void;
  onPlanChange: () => void;
}) => {
  const [isSavingView, setIsSavingView] = useState(false);
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const readOnly = !!search.asOf;

  // Planned and applied changes are plotted on the "browse as of date" strip.
  const { data: milestones = [] } = useMilestones(workspaceSlug, project.id);
  const timelineMarkers = useMemo(
    () =>
      buildTimelineMarkers(
        [...flattenChangeCaseMembers(changeCases), ...flattenRelationChangeCaseMembers(changeCases)],
        toMilestonesById(milestones)
      ),
    [changeCases, milestones]
  );

  const { data: savedViews = [], isFetched: savedViewsFetched } = useSavedViews(workspaceSlug, {
    projectId: project.id
  });
  const createSavedViewMutation = useCreateSavedView(workspaceSlug);
  const updateSavedViewMutation = useUpdateSavedView(workspaceSlug);
  const conditions = useMemo(() => parseConditionsFromSearch(search), [search]);
  const entityQuery = useMemo(() => parseEntityQueryFromSearch(search), [search]);
  const typeFilter = useMemo(
    () => entityQuery?.schemaId ?? getSingleFacetValue(conditions, '_schemaId'),
    [conditions, entityQuery]
  );
  const statusFilter = useMemo(() => getSingleFacetValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getSingleFacetValue(conditions, '_owner'), [conditions]);
  const view = (search.viewMode ?? 'table') as BrowserView;
  const q = search.q ?? '';
  const sort = search.sort ?? 'name';
  const projectScope = search.projectScope ?? 'project';
  const viewConfigs = useMemo(() => parseViewConfigs(search.viewConfigs), [search.viewConfigs]);
  const activeSavedView = useMemo(
    () => savedViews.find(savedView => savedView.id === search.viewId) ?? null,
    [savedViews, search.viewId]
  );
  useEffect(() => {
    if (!savedViewsFetched || search.viewId == null || activeSavedView != null) return;
    navigate({
      ...projectDetailRoute(workspaceSlug, asProjectPublicId(project.id)),
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        viewId: undefined
      }),
      replace: true
    });
  }, [activeSavedView, navigate, project.id, savedViewsFetched, search.viewId, workspaceSlug]);

  const handleSaveView = async (
    name: string,
    description: string,
    _scope: 'workspace' | 'project',
    isAdminView: boolean
  ) => {
    try {
      await createSavedViewMutation.mutateAsync(
        buildSavedViewPayload({
          scope: 'project',
          projectId: project.id,
          projectScope,
          name,
          description,
          isAdminView,
          view,
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
    if (activeSavedView == null) return;
    if (activeSavedView.scope !== 'project' || !project.canEdit) return;
    const savedViewPayload = buildSavedViewPayload({
      scope: activeSavedView.scope,
      projectId: project.id,
      projectScope,
      name: activeSavedView.name,
      description: activeSavedView.description ?? '',
      isAdminView: activeSavedView.isAdminView,
      view,
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
          projectScope: activeSavedView.scope === 'project' ? projectScope : null,
          viewMode: view,
          filters: savedViewPayload.filters,
          config: savedViewPayload.config
        }
      });
    } catch {
      // Error handling is done by TanStack Query
    }
  }, [
    activeSavedView,
    project.canEdit,
    project.id,
    projectScope,
    view,
    typeFilter,
    statusFilter,
    ownerFilter,
    q,
    sort,
    conditions,
    entityQuery,
    viewConfigs,
    search.joinAssessmentId,
    updateSavedViewMutation
  ]);

  const viewMenuItems = useMemo<MenuItem[]>(() => {
    if (readOnly) return [];
    const items: MenuItem[] = [];

    const hasActiveProjectView =
      activeSavedView != null && activeSavedView.scope === 'project' && project.canEdit;
    const canUseViewActions = hasActiveProjectView;
    const canSaveNewView = project.canEdit;

    items.push({
      label: activeSavedView != null ? `Save View (${activeSavedView.name})` : 'Save View',
      icon: <TbCheck size={14} />,
      disabled: !canUseViewActions,
      onClick: handleUpdateSavedView
    });

    items.push({
      label: 'Save View As...',
      icon: <TbCopy size={14} />,
      disabled: !canSaveNewView,
      onClick: () => setIsSavingView(true)
    });

    return items;
  }, [
    activeSavedView,
    handleUpdateSavedView,
    project.canEdit,
    activeSavedView?.name,
    readOnly
  ]);

  const entityMenuItems = useMemo<MenuItem[]>(() => {
    if (readOnly || !project.canEdit) return [];
    return [{ label: 'Plan change', icon: <TbCalendarEvent size={14} />, onClick: onPlanChange }];
  }, [readOnly, project.canEdit, onPlanChange]);

  const dotsMenuItems = useMemo<MenuItem[]>(
    () => [...entityMenuItems, ...viewMenuItems],
    [entityMenuItems, viewMenuItems]
  );

  return (
    <ProjectScreenLayout
      breadcrumbs={[
        {
          label: 'Home',
          onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
        },
        { label: 'Projects', onClick: onNavigateHome },
        { label: project.name, onClick: onNavigateProject }
      ]}
      title={activeSavedView?.name ?? 'Project Entities'}
      description={activeSavedView?.description || undefined}
      actions={
        !readOnly && project.canEdit ? (
          <Button variant="primary" icon={<TbPlus size={12} />} onClick={onAddEntity}>
            Add Entity
          </Button>
        ) : undefined
      }
      menu={
        dotsMenuItems.length > 0 ? (
          <DropdownMenu
            trigger={
              <Button aria-label="Project entity view actions" icon={<TbDots size={14} />} />
            }
            items={dotsMenuItems}
          />
        ) : undefined
      }
    >
      <div className={styles.fill}>
        <EntityBrowser
          projectContext={{
            project: { id: project.id, canEdit: project.canEdit },
            projectEntities,
            entityTypeColorMap,
            onToggleDone,
            onRemoveEntity,
            onPlanFutureChange
          }}
          timelineMarkers={timelineMarkers}
        />
      </div>
      <SaveViewDialog
        open={isSavingView}
        onClose={() => setIsSavingView(false)}
        onSave={handleSaveView}
        defaultScope="project"
        showAdminOption={permissions.canManageAdminViews}
      />
    </ProjectScreenLayout>
  );
};
