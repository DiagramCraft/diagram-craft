import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import {
  TbCalendarEvent,
  TbPlus,
  TbCheck,
  TbDots,
  TbCopy,
  TbPencil,
  TbTrash,
  TbFlag,
  TbUsers
} from 'react-icons/tb';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { Chip } from '../../components/Chip';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { TypeBadge } from '../../components/TypeBadge';
import { EmptyState } from '../../components/EmptyState';
import { ToolbarFilterBar, ToolbarFilterSelect } from '../../components/ToolbarFilter';
import styles from './ProjectDetailScreen.module.css';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import { ProjectTimelineTab } from './ProjectTimelineTab';
import { ProjectMilestones } from './ProjectMilestones';
import { ProjectChangesSummaryTab } from './ProjectChangesSummaryTab';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCreateSavedView, useSavedViews, useUpdateSavedView } from '../../hooks/useSavedViews';
import { useWithdrawChangeCase } from '../../hooks/useChangeCases';
import { useEntityLandscapeDiff, buildProjectLandscapeDiffStates } from '../../hooks/useEntities';
import { EntityBrowser, SaveViewDialog } from '../entities/components/EntityBrowser';
import {
  buildSavedViewPayload,
  getSingleFacetValue,
  parseConditionsFromSearch,
  parseEntityQueryFromSearch,
  parseViewConfigs
} from '../entities/components/entityBrowserState';
import { asProjectPublicId, projectDetailRoute } from '../../routes/publicObjectRoutes';
import type { AsOfMarker } from '../../components/timeline/TimelineStrip';
import { formatDate } from '../../utils/dateFormat';
import { useMilestones } from '../../hooks/useMilestones';
import { useRelations } from '../../hooks/useRelations';
import { useRelationSchemas } from '../../hooks/useRelationSchemas';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { BaselineDetailView } from '../baselines/BaselineDetailView';
import {
  getSnapshotEffectiveDate,
  isChangeOverdue,
  getProjectScenarioDate,
  toMilestonesById,
  flattenChangeCaseMembers,
  flattenRelationChangeCaseMembers,
  type ChangeCaseMemberEntry
} from '../entities/components/snapshotDisplay';
import {
  diffRelationSnapshotState,
  diffSnapshotState
} from '../entities/components/entityTimelineHelpers';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

type ViewTab = 'entities' | 'timeline' | 'future-changes' | 'project-diff' | 'milestones';
type GroupBy = 'entity' | 'date';
type ShowFilter = 'all' | 'planned' | 'applied' | 'overdue';

export const ProjectEntities = ({
  section,
  project,
  projectEntities,
  changeCases,
  schemaMap,
  entityTypeColorMap,
  schemas,
  lifecycleStates,
  teams,
  onNavigateHome,
  onNavigateProject,
  onAddEntity,
  onToggleDone,
  onRemoveEntity,
  onPlanFutureChange,
  onPlanChange,
  onApplySnapshot,
  onEditSnapshot
}: {
  section: 'entities' | 'plan';
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  changeCases: ChangeCase[];
  schemaMap: Map<string, { color: string; icon: string | null }>;
  entityTypeColorMap: Map<string, string>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onAddEntity: () => void;
  onToggleDone: (entityId: string, isDone: boolean) => void;
  onRemoveEntity: (entityId: string) => void;
  onPlanFutureChange: (entityId: string) => void;
  onPlanChange: () => void;
  onApplySnapshot: (entry: ChangeCaseMemberEntry) => void;
  onEditSnapshot: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const isPlan = section === 'plan';
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [isSavingView, setIsSavingView] = useState(false);
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChangeCaseMemberEntry | null>(null);

  // Entity and relation members are listed together; relations resolve names/schemas separately.
  const projectEntries = useMemo(
    () => [
      ...flattenChangeCaseMembers(changeCases),
      ...flattenRelationChangeCaseMembers(changeCases)
    ],
    [changeCases]
  );
  const futureEntries = useMemo(
    () => projectEntries.filter(entry => entry.changeCase.status === 'planned'),
    [projectEntries]
  );

  // Distinct change cases, not entity rows — a multi-entity case should count once.
  const pendingCount = new Set(futureEntries.map(entry => entry.changeCase.id)).size;
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, permissions, projects } = useWorkspaceContext();
  const withdrawChangeCaseMutation = useWithdrawChangeCase(workspaceSlug, project.id);
  const { data: milestones = [] } = useMilestones(workspaceSlug, project.id);
  const milestonesById = useMemo(() => toMilestonesById(milestones), [milestones]);
  const search = routeApi.useSearch();
  const asOf = search.asOf;
  const readOnly = !!asOf;
  const setActiveTab = useCallback(
    (tab: ViewTab) => {
      navigate({ search: previous => ({ ...previous, planTab: tab as typeof search.planTab }) });
    },
    [navigate]
  );

  // "What's changed" target date — the latest effective date across this project's planned
  // changes, falling back to the project's own end date when no planned change is dated.
  const changesTargetDate = useMemo(
    () => getProjectScenarioDate(project.target_date, changeCases, milestonesById),
    [changeCases, milestonesById, project.target_date]
  );
  // The Project Diff tab needs a target date; fall back to the default tab when there is none.
  const requestedTab = search.planTab ?? 'timeline';
  const activeTab: ViewTab = !isPlan
    ? 'entities'
    : requestedTab === 'project-diff' && changesTargetDate == null
      ? 'timeline'
      : requestedTab;
  const projectLandscapeDiffStates = useMemo(
    () =>
      changesTargetDate
        ? buildProjectLandscapeDiffStates(project.id, changesTargetDate)
        : null,
    [project.id, changesTargetDate]
  );
  const { data: landscapeDiff, isLoading: isLandscapeDiffLoading } = useEntityLandscapeDiff(
    workspaceSlug,
    projectLandscapeDiffStates?.from ?? null,
    projectLandscapeDiffStates?.to ?? null,
    activeTab === 'project-diff'
  );

  const hasRelationMembers = projectEntries.some(entry => entry.member.kind === 'relation');
  const { data: relations = [] } = useRelations(workspaceSlug, {}, { enabled: hasRelationMembers });
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceSlug, hasRelationMembers);
  const relationNameById = useMemo(
    () => new Map(relations.map(r => [r._uid, `${r._in.name} → ${r._out.name}`])),
    [relations]
  );
  const relationSchemaById = useMemo(
    () => new Map(relationSchemas.map(schema => [schema.id, schema])),
    [relationSchemas]
  );
  const relationSchemaIdByRelationId = useMemo(
    () => new Map(relations.map(r => [r._uid, r._schema.id])),
    [relations]
  );
  const entityNameById = useMemo(
    () =>
      new Map([
        ...projectEntities.map(e => [e.entity_id, e.entity_name] as const),
        ...relationNameById
      ]),
    [projectEntities, relationNameById]
  );
  const deleteTargetCaseEntityNames = useMemo(() => {
    if (!deleteTarget) return [];
    return projectEntries
      .filter(entry => entry.changeCase.id === deleteTarget.changeCase.id)
      .map(entry => entityNameById.get(entry.member.entity_id) ?? entry.member.entity_id);
  }, [deleteTarget, projectEntries, entityNameById]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await withdrawChangeCaseMutation.mutateAsync({ caseId: deleteTarget.changeCase.id });
    setDeleteTarget(null);
  };

  const timelineMarkers = useMemo<AsOfMarker[]>(() => {
    const counts = new Map<string, number>();
    for (const entry of projectEntries) {
      const effectiveDate = getSnapshotEffectiveDate(entry.changeCase, milestonesById);
      if (!effectiveDate) continue;
      const status = entry.changeCase.status === 'applied' ? 'applied' : 'future_update';
      const key = `${effectiveDate}|${status}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => {
      const [date, type] = key.split('|') as [string, 'future_update' | 'applied'];
      return { date, type, count };
    });
  }, [projectEntries, milestonesById]);
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
    const canUseViewActions = activeTab === 'entities' && hasActiveProjectView;
    const canSaveNewView = activeTab === 'entities' && project.canEdit;

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
    activeTab,
    activeSavedView,
    handleUpdateSavedView,
    project.canEdit,
    activeSavedView?.name,
    readOnly
  ]);

  const entityMenuItems = useMemo<MenuItem[]>(() => {
    if (readOnly || !project.canEdit) return [];
    return [
      {
        label: 'Plan change',
        icon: <TbCalendarEvent size={14} />,
        onClick: onPlanChange
      }
    ];
  }, [readOnly, project.canEdit, onPlanChange]);

  const dotsMenuItems = useMemo<MenuItem[]>(
    () =>
      isPlan
        ? project.canEdit
          ? [
              {
                label: 'New milestone',
                icon: <TbFlag size={14} />,
                onClick: () => {
                  setActiveTab('milestones');
                  setIsCreatingMilestone(true);
                }
              }
            ]
          : []
        : [...entityMenuItems, ...viewMenuItems],
    [isPlan, project.canEdit, entityMenuItems, viewMenuItems, setActiveTab]
  );

  if (search.baselineId) {
    return (
      <BaselineDetailView
        workspaceSlug={workspaceSlug}
        baselineId={search.baselineId}
        onDeleted={() =>
          navigate({
            ...projectDetailRoute(workspaceSlug, asProjectPublicId(project.id)),
            search: (previous: Record<string, unknown>) => ({
              ...previous,
              section: 'entities',
              baselineId: undefined,
              sidebarTab: undefined,
              asOf: undefined,
              asOfIncludeProjects: undefined
            })
          })
        }
      />
    );
  }

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
      title={isPlan ? 'Plan' : (activeSavedView?.name ?? 'Project Entities')}
      description={isPlan ? undefined : activeSavedView?.description || undefined}
      actions={
        isPlan ? (
          project.canEdit ? (
            <Button variant="primary" icon={<TbCalendarEvent size={12} />} onClick={onPlanChange}>
              Plan change
            </Button>
          ) : undefined
        ) : !readOnly && project.canEdit ? (
          <Button variant="primary" icon={<TbPlus size={12} />} onClick={onAddEntity}>
            Add Entity
          </Button>
        ) : undefined
      }
      menu={
        dotsMenuItems.length > 0 ? (
          <DropdownMenu
            trigger={
              <Button aria-label={isPlan ? 'Plan actions' : 'Project entity view actions'} icon={<TbDots size={14} />} />
            }
            items={dotsMenuItems}
          />
        ) : undefined
      }
      toolbar={
        isPlan ? (
          <div className={styles.tabBar}>
            <div className={styles.entityTabNav}>
              <button
                type="button"
                className={`${styles.entityTabBtn} ${activeTab === 'timeline' ? styles.entityTabBtnActive : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
              <button
                type="button"
                className={`${styles.entityTabBtn} ${activeTab === 'future-changes' ? styles.entityTabBtnActive : ''}`}
                onClick={() => setActiveTab('future-changes')}
              >
                Future changes{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
              {changesTargetDate != null && (
                <button
                  type="button"
                  className={`${styles.entityTabBtn} ${activeTab === 'project-diff' ? styles.entityTabBtnActive : ''}`}
                  onClick={() => setActiveTab('project-diff')}
                >
                  Project Diff
                </button>
              )}
              <button
                type="button"
                className={`${styles.entityTabBtn} ${activeTab === 'milestones' ? styles.entityTabBtnActive : ''}`}
                onClick={() => setActiveTab('milestones')}
              >
                Milestones
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {activeTab === 'entities' ? (
        <div className={`${styles.entityTab} ${styles.entityTabFill}`}>
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
      ) : activeTab === 'future-changes' ? (
        <FutureChangesTab
          project={project}
          changeEntries={projectEntries}
          relationNameById={relationNameById}
          relationSchemaById={relationSchemaById}
          relationSchemaIdByRelationId={relationSchemaIdByRelationId}
          projectEntities={projectEntities}
          schemaMap={schemaMap}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          teams={teams}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          milestonesById={milestonesById}
          onApplySnapshot={onApplySnapshot}
          onEditSnapshot={onEditSnapshot}
          onDeleteSnapshot={setDeleteTarget}
        />
      ) : activeTab === 'milestones' ? (
        <ProjectMilestones
          project={project}
          creating={isCreatingMilestone}
          onCreatingChange={setIsCreatingMilestone}
        />
      ) : activeTab === 'timeline' ? (
        <div className={`${styles.entityTab} ${styles.entityTabFill}`}>
          <ProjectTimelineTab
            project={project}
            projectEntities={projectEntities}
            changeCases={changeCases}
            schemaMap={schemaMap}
            entityTypeColorMap={entityTypeColorMap}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            teams={teams}
            milestonesById={milestonesById}
            canEdit={project.canEdit}
            onApplySnapshot={onApplySnapshot}
            onEditSnapshot={onEditSnapshot}
            onDeleteSnapshot={setDeleteTarget}
          />
        </div>
      ) : (
        <div className={`${styles.entityTab} ${styles.entityTabFill}`}>
          <ProjectChangesSummaryTab
            workspaceId={workspaceSlug}
            project={project}
            projects={projects}
            diff={landscapeDiff}
            isLoading={isLandscapeDiffLoading}
            targetDate={changesTargetDate}
            schemaMap={schemaMap}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            teams={teams}
          />
        </div>
      )}
      <SaveViewDialog
        open={isSavingView}
        onClose={() => setIsSavingView(false)}
        onSave={handleSaveView}
        defaultScope="project"
        showAdminOption={permissions.canManageAdminViews}
      />
      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title="Delete future change"
        message={
          deleteTargetCaseEntityNames.length > 1
            ? `Delete this planned change for ${deleteTargetCaseEntityNames.length} entities?`
            : 'Delete this planned future change?'
        }
        detail={
          <>
            This removes the planned change without modifying any current entity.
            {deleteTargetCaseEntityNames.length > 1 && (
              <>
                <br />
                Affected entities: {deleteTargetCaseEntityNames.join(', ')}
              </>
            )}
          </>
        }
        confirmLabel={withdrawChangeCaseMutation.isPending ? 'Deleting...' : 'Delete change'}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </ProjectScreenLayout>
  );
};

const FutureChangesTab = ({
  project,
  changeEntries,
  relationNameById,
  relationSchemaById,
  relationSchemaIdByRelationId,
  projectEntities,
  schemaMap,
  schemas,
  lifecycleStates,
  teams,
  groupBy,
  onGroupByChange,
  milestonesById,
  onApplySnapshot,
  onEditSnapshot,
  onDeleteSnapshot
}: {
  project: ProjectDetailData;
  changeEntries: ChangeCaseMemberEntry[];
  relationNameById: Map<string, string>;
  relationSchemaById: Map<string, RelationSchema>;
  relationSchemaIdByRelationId: Map<string, string>;
  projectEntities: ProjectEntity[];
  schemaMap: Map<string, { color: string; icon: string | null }>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  milestonesById: Map<string, Milestone>;
  onApplySnapshot: (entry: ChangeCaseMemberEntry) => void;
  onEditSnapshot: (entry: ChangeCaseMemberEntry) => void;
  onDeleteSnapshot: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const [show, setShow] = useState<ShowFilter>('all');

  if (changeEntries.length === 0) {
    return (
      <div className={styles.entityTab}>
        <EmptyState
          framed
          icon={<TbCalendarEvent size={22} />}
          title="No future changes planned"
          subtitle="Use the entity menu to plan future changes for entities in this project."
        />
      </div>
    );
  }

  const visibleEntries = changeEntries.filter(entry => {
    const planned = entry.changeCase.status === 'planned';
    switch (show) {
      case 'planned':
        return planned;
      case 'applied':
        return entry.changeCase.status === 'applied';
      case 'overdue':
        return planned && isChangeOverdue(getSnapshotEffectiveDate(entry.changeCase, milestonesById));
      default:
        return true;
    }
  });

  const toolbar = (
    <div className={styles.futureToolbar}>
    <ToolbarFilterBar noPadding>
      <ToolbarFilterSelect
        label="Show"
        value={show}
        onChange={value => setShow(value as ShowFilter)}
        options={[
          { value: 'all', label: 'All' },
          { value: 'planned', label: 'Planned' },
          { value: 'applied', label: 'Applied' },
          { value: 'overdue', label: 'Overdue' }
        ]}
      />
      <div className={styles.toolbarEnd}>
        <ToolbarFilterSelect
          label="Group by"
          value={groupBy}
          onChange={value => onGroupByChange(value as GroupBy)}
          options={[
            { value: 'date', label: 'Date' },
            { value: 'entity', label: 'Entity' }
          ]}
        />
      </div>
    </ToolbarFilterBar>
    </div>
  );

  if (visibleEntries.length === 0) {
    return (
      <div className={styles.entityTab}>
        {toolbar}
        <EmptyState
          framed
          icon={<TbCalendarEvent size={22} />}
          title={`No ${show} changes`}
          subtitle={
            show === 'overdue'
              ? 'None of the planned changes have a target date in the past.'
              : 'Nothing matches this filter.'
          }
        />
      </div>
    );
  }

  const entityMap = new Map(projectEntities.map(e => [e.entity_id, e]));
  const nameOf = (id: string) => entityMap.get(id)?.entity_name ?? relationNameById.get(id) ?? id;
  const getRelationSchema = (entry: ChangeCaseMemberEntry) => {
    if (entry.member.kind !== 'relation') return null;
    const schemaId = relationSchemaIdByRelationId.get(entry.member.entity_id);
    return schemaId ? (relationSchemaById.get(schemaId) ?? null) : null;
  };
  const getEntitySchema = (entity: ProjectEntity | undefined) =>
    entity?.entity_schema
      ? (schemas.find(schema => schema.id === entity.entity_schema!.id) ?? null)
      : null;
  const getEntitySchemaInfo = (entity: ProjectEntity | undefined) =>
    entity?.entity_schema ? schemaMap.get(entity.entity_schema.id) : undefined;

  // Entities sharing a change case with each other — drives the "also includes" note in the
  // group-by-entity view and the nested case panels in the group-by-date view.
  const caseMembersMap = new Map<string, ChangeCaseMemberEntry[]>();
  for (const entry of visibleEntries) {
    const list = caseMembersMap.get(entry.changeCase.id);
    if (list) list.push(entry);
    else caseMembersMap.set(entry.changeCase.id, [entry]);
  }

  if (groupBy === 'entity') {
    // Group by entity_id
    const groups = new Map<string, ChangeCaseMemberEntry[]>();
    for (const entry of visibleEntries) {
      const list = groups.get(entry.member.entity_id);
      if (list) list.push(entry);
      else groups.set(entry.member.entity_id, [entry]);
    }

    return (
      <div className={styles.entityTab}>
        {toolbar}
        <div className={styles.futureChangesGroups}>
          {[...groups.entries()].map(([entityId, snaps]) => {
            const pe = entityMap.get(entityId);
            const schema = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
            const relationSchema = getRelationSchema(snaps[0]!);
            return (
              <div key={entityId} className={styles.futureGroup}>
                <div className={styles.futureGroupHead}>
                  {schema && <TypeBadge color={schema.color} icon={schema.icon} size={16} />}
                  <span className={styles.futureGroupName}>{nameOf(entityId)}</span>
                  {pe?.entity_schema && <Chip tone="ghost">{pe.entity_schema.name}</Chip>}
                  {relationSchema && <Chip tone="ghost">{relationSchema.name}</Chip>}
                </div>
                {snaps.map(entry => {
                  const otherEntityNames = (caseMembersMap.get(entry.changeCase.id) ?? [])
                    .filter(e => e.member.entity_id !== entityId)
                    .map(e => nameOf(e.member.entity_id));
                  return (
                    <FutureSnapshotRow
                      key={entry.member.id}
                      entry={entry}
                      showEntity={false}
                      showMilestone
                      entitySchema={getEntitySchema(pe)}
                      entitySchemaInfo={getEntitySchemaInfo(pe)}
                      relationSchema={getRelationSchema(entry)}
                      milestonesById={milestonesById}
                      lifecycleStates={lifecycleStates}
                      teams={teams}
                      canEdit={project.canEdit}
                      otherEntityNames={otherEntityNames}
                      onApply={onApplySnapshot}
                      onEdit={onEditSnapshot}
                      onDelete={onDeleteSnapshot}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Group by (effective) date — a milestone-backed snapshot has no target_date of its own, so
  // fall back to the milestone's target_date, grouping it alongside any raw-dated snapshots
  // targeting the same day.
  const groups = new Map<string, ChangeCaseMemberEntry[]>();
  for (const entry of visibleEntries) {
    const key = getSnapshotEffectiveDate(entry.changeCase, milestonesById) ?? '__no-date__';
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  // Sort: dated groups first (ascending), then no-date
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '__no-date__') return 1;
    if (b === '__no-date__') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className={styles.entityTab}>
      {toolbar}
      <div className={styles.futureChangesGroups}>
        {sortedKeys.map(key => {
          const snaps = groups.get(key)!;
          const label = key === '__no-date__' ? 'No target date' : formatDate(key, key);
          const groupMilestones = [
            ...new Map(
              snaps
                .filter(
                  (
                    entry
                  ): entry is ChangeCaseMemberEntry & { changeCase: { milestone_id: string } } =>
                    entry.changeCase.milestone_id != null
                )
                .map(entry => [
                  entry.changeCase.milestone_id,
                  milestonesById.get(entry.changeCase.milestone_id)
                ])
                .filter((entry): entry is [string, Milestone] => entry[1] != null)
            ).values()
          ];

          // Sub-group this date's entries by change case, so a case renders as one nested panel
          // (with its name/description) rather than as separate flat rows.
          const caseGroups = new Map<string, ChangeCaseMemberEntry[]>();
          const orderedCaseKeys: string[] = [];
          for (const entry of snaps) {
            const caseKey = entry.changeCase.id;
            if (!caseGroups.has(caseKey)) orderedCaseKeys.push(caseKey);
            const list = caseGroups.get(caseKey);
            if (list) list.push(entry);
            else caseGroups.set(caseKey, [entry]);
          }

          return (
            <div key={key} className={styles.futureGroup}>
              <div className={styles.futureGroupHead}>
                <span className={styles.futureGroupName}>{label}</span>
                {key !== '__no-date__' &&
                  isChangeOverdue(key) &&
                  snaps.some(entry => entry.changeCase.status === 'planned') && (
                  <Chip color="var(--warning-fg)" title="The target date has passed">
                    Overdue
                  </Chip>
                )}
                {groupMilestones.map(milestone => (
                  <Chip
                    key={milestone.id}
                    tone="accent"
                    icon={<TbFlag size={12} style={{ color: 'var(--accent-fg)' }} />}
                  >
                    {milestone.name}
                  </Chip>
                ))}
              </div>
              {orderedCaseKeys.map(caseKey => {
                const caseEntries = caseGroups.get(caseKey)!;
                const changeCase = caseEntries[0]!.changeCase;
                const fallbackTitle =
                  caseEntries.length === 1
                    ? nameOf(caseEntries[0]!.member.entity_id)
                    : 'Untitled change';
                const representativeEntry = caseEntries[0]!;
                return (
                  <div key={caseKey} className={styles.futureCasePanel}>
                    <div className={styles.futureCasePanelHead}>
                      <div className={styles.futureCasePanelTitleRow}>
                        <span className={styles.futureCasePanelName}>
                          {changeCase.name ?? fallbackTitle}
                        </span>
                        {caseEntries.length > 1 && (
                          <Chip tone="ghost">{caseEntries.length} entities</Chip>
                        )}
                        <div style={{ flex: 1 }} />
                        {changeCase.status === 'applied' && <Chip tone="ghost">Applied</Chip>}
                        {project.canEdit && changeCase.status === 'planned' && (
                          <DropdownMenu
                            trigger={
                              <Button
                                size="sm"
                                variant="icon-only"
                                aria-label="Change case actions"
                                title="Change case actions"
                                icon={<TbDots size={14} />}
                              />
                            }
                            items={[
                              {
                                label: 'Apply',
                                icon: <TbCheck size={14} />,
                                onClick: () => onApplySnapshot(representativeEntry)
                              },
                              {
                                label: 'Edit',
                                icon: <TbPencil size={14} />,
                                onClick: () => onEditSnapshot(representativeEntry)
                              },
                              {
                                label: 'Remove',
                                icon: <TbTrash size={14} />,
                                danger: true,
                                onClick: () => onDeleteSnapshot(representativeEntry)
                              }
                            ]}
                          />
                        )}
                      </div>
                      {changeCase.commit_message && (
                        <div className={styles.futureCasePanelDescription}>
                          {changeCase.commit_message}
                        </div>
                      )}
                    </div>
                    <div className={styles.futureCasePanelBody}>
                      {caseEntries.map(entry => {
                        const pe = entityMap.get(entry.member.entity_id);
                        return (
                          <FutureSnapshotRow
                            key={entry.member.id}
                            entry={entry}
                            showEntity={true}
                            showOverdue={false}
                            showMilestone={false}
                            showActions={false}
                            showNote={false}
                            entityName={nameOf(entry.member.entity_id)}
                            entitySchema={getEntitySchema(pe)}
                            entitySchemaInfo={getEntitySchemaInfo(pe)}
                            relationSchema={getRelationSchema(entry)}
                            milestonesById={milestonesById}
                            lifecycleStates={lifecycleStates}
                            teams={teams}
                            canEdit={project.canEdit}
                            onApply={onApplySnapshot}
                            onEdit={onEditSnapshot}
                            onDelete={onDeleteSnapshot}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FutureSnapshotRow = ({
  entry,
  showEntity,
  showMilestone,
  entityName,
  entitySchema,
  entitySchemaInfo,
  relationSchema,
  milestonesById,
  lifecycleStates,
  teams,
  canEdit,
  showActions = true,
  showNote = true,
  showOverdue = true,
  otherEntityNames = [],
  onApply,
  onEdit,
  onDelete
}: {
  entry: ChangeCaseMemberEntry;
  showEntity: boolean;
  showMilestone: boolean;
  entityName?: string;
  entitySchema: EntitySchema | null;
  entitySchemaInfo?: { color: string; icon: string | null };
  relationSchema?: RelationSchema | null;
  milestonesById: Map<string, Milestone>;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canEdit: boolean;
  showActions?: boolean;
  showNote?: boolean;
  showOverdue?: boolean;
  otherEntityNames?: string[];
  onApply: (entry: ChangeCaseMemberEntry) => void;
  onEdit: (entry: ChangeCaseMemberEntry) => void;
  onDelete: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const { changeCase, member } = entry;
  const milestone = changeCase.milestone_id
    ? milestonesById.get(changeCase.milestone_id)
    : undefined;
  const date = changeCase.target_date ?? milestone?.target_date ?? null;
  const dateLabel = date ? formatDate(date) : null;
  const changes =
    member.kind === 'relation'
      ? diffRelationSnapshotState(member.base_state, member.proposed_state, relationSchema ?? null)
      : diffSnapshotState(
          member.base_state,
          member.proposed_state,
          entitySchema,
          lifecycleStates,
          teams
        );

  return (
    <div className={styles.futureRow}>
      {showEntity && (
        <div className={styles.futureRowEntity}>
          {entitySchemaInfo && (
            <TypeBadge color={entitySchemaInfo.color} icon={entitySchemaInfo.icon} size={14} />
          )}
          <span>{entityName ?? member.entity_id}</span>
          {relationSchema && <Chip tone="ghost">{relationSchema.name}</Chip>}
        </div>
      )}
      {otherEntityNames.length > 0 && (
        <div className={styles.futureRowAlsoIncludes}>
          <TbUsers size={12} />
          <span>Also includes {otherEntityNames.join(', ')}</span>
        </div>
      )}
      <div className={styles.futureRowBody}>
        <div className={styles.futureRowMeta}>
          {dateLabel && <span className={styles.futureRowDate}>{dateLabel}</span>}
          {changeCase.status === 'applied' && <Chip tone="ghost">Applied</Chip>}
          {showOverdue && changeCase.status === 'planned' && isChangeOverdue(date) && (
            <Chip color="var(--warning-fg)" title="The target date has passed">
              Overdue
            </Chip>
          )}
          {showMilestone && milestone && (
            <Chip tone="accent" icon={<TbFlag size={12} style={{ color: 'var(--accent-fg)' }} />}>
              {milestone.name}
            </Chip>
          )}
          {showNote && changeCase.commit_message && (
            <span className={styles.futureRowNote}>{changeCase.commit_message}</span>
          )}
        </div>
        {canEdit && showActions && changeCase.status === 'planned' && (
          <div className={styles.futureRowActions}>
            <DropdownMenu
              trigger={
                <Button
                  size="sm"
                  variant="icon-only"
                  aria-label="Future change actions"
                  title="Future change actions"
                  icon={<TbDots size={14} />}
                />
              }
              items={[
                {
                  label: 'Apply',
                  icon: <TbCheck size={14} />,
                  onClick: () => onApply(entry)
                },
                {
                  label: 'Edit',
                  icon: <TbPencil size={14} />,
                  onClick: () => onEdit(entry)
                },
                {
                  label: 'Remove',
                  icon: <TbTrash size={14} />,
                  danger: true,
                  onClick: () => onDelete(entry)
                }
              ]}
            />
          </div>
        )}
      </div>
      <div className={styles.futureRowChanges}>
        <div className={styles.futureRowChangesTitle}>Changes</div>
        {changes.length > 0 ? (
          changes.map(change => (
            <div key={change.label} className={styles.futureRowChange}>
              <span className={styles.futureRowChangeField}>{change.label}</span>
              <span className={styles.futureRowChangeFrom}>{change.from}</span>
              <span className={styles.futureRowChangeArrow}>→</span>
              <span className={styles.futureRowChangeTo}>{change.to}</span>
            </div>
          ))
        ) : (
          <span className={styles.futureRowNoChanges}>Restricted changes</span>
        )}
      </div>
    </div>
  );
};
