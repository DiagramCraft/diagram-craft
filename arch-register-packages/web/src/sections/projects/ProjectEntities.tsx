import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import {
  TbCalendarEvent,
  TbPlus,
  TbLayoutList,
  TbCalendar,
  TbCheck,
  TbDots,
  TbCopy,
  TbPencil,
  TbTrash,
  TbFlag,
  TbUsers
} from 'react-icons/tb';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import type {
  ProjectDetail as ProjectDetailData,
  ProjectEntity
} from '@arch-register/api-types/projectContract';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { Chip } from '../../components/Chip';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { TypeBadge } from '../../components/TypeBadge';
import { EmptyState } from '../../components/EmptyState';
import styles from './ProjectDetailScreen.module.css';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import { ProjectTimelineTab } from './ProjectTimelineTab';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCreateSavedView, useSavedViews, useUpdateSavedView } from '../../hooks/useSavedViews';
import { useChangeCasesByProject, useWithdrawChangeCase } from '../../hooks/useChangeCases';
import { EntityBrowser, SaveViewDialog } from '../entities/components/EntityBrowser';
import {
  buildSavedViewPayload,
  getFilterValue,
  parseConditionsFromSearch,
  parseEntityQueryFromSearch,
  parseViewConfigs
} from '../entities/components/entityBrowserState';
import { asProjectPublicId, projectDetailRoute } from '../../routes/publicObjectRoutes';
import type { AsOfMarker } from '../../components/timeline/TimelineStrip';
import { formatDate } from '../../utils/dateFormat';
import { useMilestones } from '../../hooks/useMilestones';
import { getSnapshotEffectiveDate, toMilestonesById } from '../entities/components/snapshotDisplay';
import { diffSnapshotState } from '../entities/components/entityTimelineHelpers';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

type ViewTab = 'entities' | 'future-changes' | 'timeline';
type GroupBy = 'entity' | 'date';

export const ProjectEntities = ({
  project,
  projectEntities,
  projectSnapshots,
  futureSnapshots,
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
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  projectSnapshots: EntitySnapshot[];
  futureSnapshots: EntitySnapshot[];
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
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
  onEditSnapshot: (snapshot: EntitySnapshot) => void;
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('entities');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [isSavingView, setIsSavingView] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntitySnapshot | null>(null);

  // Distinct change cases, not entity rows — a multi-entity case should count once.
  const pendingCount = new Set(futureSnapshots.map(s => s.case_id ?? s.id)).size;
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const withdrawChangeCaseMutation = useWithdrawChangeCase(workspaceSlug, project.id);
  const { data: milestones = [] } = useMilestones(workspaceSlug, project.id);
  const milestonesById = useMemo(() => toMilestonesById(milestones), [milestones]);
  const { data: changeCases = [] } = useChangeCasesByProject(workspaceSlug, project.id);
  const changeCaseById = useMemo(() => new Map(changeCases.map(c => [c.id, c])), [changeCases]);
  const search = routeApi.useSearch();
  const asOf = search.asOf;
  const readOnly = !!asOf;

  const entityNameById = useMemo(
    () => new Map(projectEntities.map(e => [e.entity_id, e.entity_name])),
    [projectEntities]
  );
  const deleteTargetCaseEntityNames = useMemo(() => {
    if (!deleteTarget?.case_id) return [];
    return projectSnapshots
      .filter(s => s.case_id === deleteTarget.case_id)
      .map(s => entityNameById.get(s.entity_id) ?? s.entity_id);
  }, [deleteTarget, projectSnapshots, entityNameById]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.case_id) return;
    await withdrawChangeCaseMutation.mutateAsync({ caseId: deleteTarget.case_id });
    setDeleteTarget(null);
  };

  useEffect(() => {
    if (readOnly && activeTab !== 'entities') setActiveTab('entities');
  }, [readOnly, activeTab]);

  const timelineMarkers = useMemo<AsOfMarker[]>(() => {
    const counts = new Map<string, number>();
    for (const snapshot of projectSnapshots) {
      if (snapshot.status !== 'future_update' && snapshot.status !== 'applied') continue;
      const effectiveDate = getSnapshotEffectiveDate(snapshot, milestonesById);
      if (!effectiveDate) continue;
      const key = `${effectiveDate}|${snapshot.status}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => {
      const [date, type] = key.split('|') as [string, 'future_update' | 'applied'];
      return { date, type, count };
    });
  }, [projectSnapshots, milestonesById]);
  const { data: savedViews = [], isFetched: savedViewsFetched } = useSavedViews(workspaceSlug, {
    projectId: project.id
  });
  const createSavedViewMutation = useCreateSavedView(workspaceSlug);
  const updateSavedViewMutation = useUpdateSavedView(workspaceSlug);
  const conditions = useMemo(() => parseConditionsFromSearch(search), [search]);
  const entityQuery = useMemo(() => parseEntityQueryFromSearch(search), [search]);
  const typeFilter = useMemo(
    () => entityQuery?.schemaId ?? getFilterValue(conditions, '_schemaId'),
    [conditions, entityQuery]
  );
  const statusFilter = useMemo(() => getFilterValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getFilterValue(conditions, '_owner'), [conditions]);
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

    items.push({
      label: activeSavedView != null ? `Save View (${activeSavedView.name})` : 'Save View',
      icon: <TbCheck size={14} />,
      disabled: !canUseViewActions,
      onClick: handleUpdateSavedView
    });

    items.push({
      label: 'Save View As...',
      icon: <TbCopy size={14} />,
      disabled: !canUseViewActions,
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
      title="Project Entities"
      actions={
        !readOnly && project.canEdit ? (
          <Button variant="primary" icon={<TbPlus size={12} />} onClick={onAddEntity}>
            Link
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
      toolbar={
        <div className={styles.tabBar}>
          <div className={styles.entityTabNav}>
            <button
              type="button"
              className={`${styles.entityTabBtn} ${activeTab === 'entities' ? styles.entityTabBtnActive : ''}`}
              onClick={() => setActiveTab('entities')}
            >
              Entities
            </button>
            {!readOnly && (
              <button
                type="button"
                className={`${styles.entityTabBtn} ${activeTab === 'future-changes' ? styles.entityTabBtnActive : ''}`}
                onClick={() => setActiveTab('future-changes')}
              >
                Future changes{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                className={`${styles.entityTabBtn} ${activeTab === 'timeline' ? styles.entityTabBtnActive : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
            )}
          </div>
          {activeTab === 'future-changes' && pendingCount > 0 && (
            <div className={styles.tabBarRight}>
              <button
                type="button"
                className={`${styles.groupByBtn} ${groupBy === 'entity' ? styles.groupByBtnActive : ''}`}
                onClick={() => setGroupBy('entity')}
                title="Group by entity"
              >
                <TbLayoutList size={14} />
              </button>
              <button
                type="button"
                className={`${styles.groupByBtn} ${groupBy === 'date' ? styles.groupByBtnActive : ''}`}
                onClick={() => setGroupBy('date')}
                title="Group by date"
              >
                <TbCalendar size={14} />
              </button>
            </div>
          )}
        </div>
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
          futureSnapshots={futureSnapshots}
          projectEntities={projectEntities}
          schemaMap={schemaMap}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          teams={teams}
          groupBy={groupBy}
          milestonesById={milestonesById}
          changeCaseById={changeCaseById}
          onApplySnapshot={onApplySnapshot}
          onEditSnapshot={onEditSnapshot}
          onDeleteSnapshot={setDeleteTarget}
        />
      ) : (
        <div className={`${styles.entityTab} ${styles.entityTabFill}`}>
          <ProjectTimelineTab
            project={project}
            projectEntities={projectEntities}
            projectSnapshots={projectSnapshots}
            schemaMap={schemaMap}
            entityTypeColorMap={entityTypeColorMap}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            teams={teams}
            milestonesById={milestonesById}
            changeCaseById={changeCaseById}
            canEdit={project.canEdit}
            onApplySnapshot={onApplySnapshot}
            onEditSnapshot={onEditSnapshot}
            onDeleteSnapshot={setDeleteTarget}
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
  futureSnapshots,
  projectEntities,
  schemaMap,
  schemas,
  lifecycleStates,
  teams,
  groupBy,
  milestonesById,
  changeCaseById,
  onApplySnapshot,
  onEditSnapshot,
  onDeleteSnapshot
}: {
  project: ProjectDetailData;
  futureSnapshots: EntitySnapshot[];
  projectEntities: ProjectEntity[];
  schemaMap: Map<string, { color: string; icon: string | null }>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  groupBy: GroupBy;
  milestonesById: Map<string, Milestone>;
  changeCaseById: Map<string, ChangeCase>;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
  onEditSnapshot: (snapshot: EntitySnapshot) => void;
  onDeleteSnapshot: (snapshot: EntitySnapshot) => void;
}) => {
  if (futureSnapshots.length === 0) {
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

  const entityMap = new Map(projectEntities.map(e => [e.entity_id, e]));
  const getEntitySchema = (entity: ProjectEntity | undefined) =>
    entity?.entity_schema
      ? (schemas.find(schema => schema.id === entity.entity_schema!.id) ?? null)
      : null;
  const getEntitySchemaInfo = (entity: ProjectEntity | undefined) =>
    entity?.entity_schema ? schemaMap.get(entity.entity_schema.id) : undefined;

  // Entities sharing a change case with each other — drives the "also includes" note in the
  // group-by-entity view and the nested case panels in the group-by-date view.
  const caseMembersMap = new Map<string, EntitySnapshot[]>();
  for (const snap of futureSnapshots) {
    if (!snap.case_id) continue;
    const list = caseMembersMap.get(snap.case_id);
    if (list) list.push(snap);
    else caseMembersMap.set(snap.case_id, [snap]);
  }

  if (groupBy === 'entity') {
    // Group by entity_id
    const groups = new Map<string, EntitySnapshot[]>();
    for (const snap of futureSnapshots) {
      const list = groups.get(snap.entity_id);
      if (list) list.push(snap);
      else groups.set(snap.entity_id, [snap]);
    }

    return (
      <div className={styles.entityTab}>
        <div className={styles.futureChangesGroups}>
          {[...groups.entries()].map(([entityId, snaps]) => {
            const pe = entityMap.get(entityId);
            const schema = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
            return (
              <div key={entityId} className={styles.futureGroup}>
                <div className={styles.futureGroupHead}>
                  {schema && <TypeBadge color={schema.color} icon={schema.icon} size={16} />}
                  <span className={styles.futureGroupName}>{pe?.entity_name ?? entityId}</span>
                  {pe?.entity_schema && <Chip tone="ghost">{pe.entity_schema.name}</Chip>}
                </div>
                {snaps.map(snap => {
                  const otherEntityNames = snap.case_id
                    ? (caseMembersMap.get(snap.case_id) ?? [])
                        .filter(s => s.entity_id !== entityId)
                        .map(s => entityMap.get(s.entity_id)?.entity_name ?? s.entity_id)
                    : [];
                  return (
                    <FutureSnapshotRow
                      key={snap.id}
                      snap={snap}
                      showEntity={false}
                      showMilestone
                      entitySchema={getEntitySchema(pe)}
                      entitySchemaInfo={getEntitySchemaInfo(pe)}
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
  const groups = new Map<string, EntitySnapshot[]>();
  for (const snap of futureSnapshots) {
    const key = getSnapshotEffectiveDate(snap, milestonesById) ?? '__no-date__';
    const list = groups.get(key);
    if (list) list.push(snap);
    else groups.set(key, [snap]);
  }

  // Sort: dated groups first (ascending), then no-date
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '__no-date__') return 1;
    if (b === '__no-date__') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className={styles.entityTab}>
      <div className={styles.futureChangesGroups}>
        {sortedKeys.map(key => {
          const snaps = groups.get(key)!;
          const label = key === '__no-date__' ? 'No target date' : formatDate(key, key);
          const groupMilestones = [
            ...new Map(
              snaps
                .filter(
                  (snap): snap is EntitySnapshot & { milestone_id: string } =>
                    snap.milestone_id != null
                )
                .map(snap => [snap.milestone_id, milestonesById.get(snap.milestone_id)])
                .filter((entry): entry is [string, Milestone] => entry[1] != null)
            ).values()
          ];

          // Sub-group this date's snapshots by change case, so a case renders as one nested
          // panel (with its name/description) rather than as separate flat rows.
          const caseGroups = new Map<string, EntitySnapshot[]>();
          const orderedCaseKeys: string[] = [];
          for (const snap of snaps) {
            const caseKey = snap.case_id ?? snap.id;
            if (!caseGroups.has(caseKey)) orderedCaseKeys.push(caseKey);
            const list = caseGroups.get(caseKey);
            if (list) list.push(snap);
            else caseGroups.set(caseKey, [snap]);
          }

          return (
            <div key={key} className={styles.futureGroup}>
              <div className={styles.futureGroupHead}>
                <span className={styles.futureGroupName}>{label}</span>
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
                const caseSnaps = caseGroups.get(caseKey)!;
                const changeCase = caseSnaps[0]!.case_id
                  ? changeCaseById.get(caseSnaps[0]!.case_id!)
                  : undefined;
                const fallbackTitle =
                  caseSnaps.length === 1
                    ? (entityMap.get(caseSnaps[0]!.entity_id)?.entity_name ??
                      caseSnaps[0]!.entity_id)
                    : 'Untitled change';
                const representativeSnap = caseSnaps[0]!;
                return (
                  <div key={caseKey} className={styles.futureCasePanel}>
                    <div className={styles.futureCasePanelHead}>
                      <div className={styles.futureCasePanelTitleRow}>
                        <span className={styles.futureCasePanelName}>
                          {changeCase?.name ?? fallbackTitle}
                        </span>
                        {caseSnaps.length > 1 && <Chip tone="ghost">{caseSnaps.length} entities</Chip>}
                        <div style={{ flex: 1 }} />
                        {project.canEdit && (
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
                                onClick: () => onApplySnapshot(representativeSnap)
                              },
                              {
                                label: 'Edit',
                                icon: <TbPencil size={14} />,
                                onClick: () => onEditSnapshot(representativeSnap)
                              },
                              {
                                label: 'Remove',
                                icon: <TbTrash size={14} />,
                                danger: true,
                                onClick: () => onDeleteSnapshot(representativeSnap)
                              }
                            ]}
                          />
                        )}
                      </div>
                      {changeCase?.commit_message && (
                        <div className={styles.futureCasePanelDescription}>
                          {changeCase.commit_message}
                        </div>
                      )}
                    </div>
                    <div className={styles.futureCasePanelBody}>
                      {caseSnaps.map(snap => {
                        const pe = entityMap.get(snap.entity_id);
                        return (
                          <FutureSnapshotRow
                            key={snap.id}
                            snap={snap}
                            showEntity={true}
                            showMilestone={false}
                            showActions={false}
                            showNote={false}
                            entityName={pe?.entity_name}
                            entitySchema={getEntitySchema(pe)}
                            entitySchemaInfo={getEntitySchemaInfo(pe)}
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
  snap,
  showEntity,
  showMilestone,
  entityName,
  entitySchema,
  entitySchemaInfo,
  milestonesById,
  lifecycleStates,
  teams,
  canEdit,
  showActions = true,
  showNote = true,
  otherEntityNames = [],
  onApply,
  onEdit,
  onDelete
}: {
  snap: EntitySnapshot;
  showEntity: boolean;
  showMilestone: boolean;
  entityName?: string;
  entitySchema: EntitySchema | null;
  entitySchemaInfo?: { color: string; icon: string | null };
  milestonesById: Map<string, Milestone>;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canEdit: boolean;
  showActions?: boolean;
  showNote?: boolean;
  otherEntityNames?: string[];
  onApply: (snapshot: EntitySnapshot) => void;
  onEdit: (snapshot: EntitySnapshot) => void;
  onDelete: (snapshot: EntitySnapshot) => void;
}) => {
  const milestone = snap.milestone_id ? milestonesById.get(snap.milestone_id) : undefined;
  const date = snap.target_date ?? milestone?.target_date ?? null;
  const dateLabel = date ? formatDate(date) : null;
  const changes = diffSnapshotState(
    snap.base_state,
    snap.proposed_state,
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
          <span>{entityName ?? snap.entity_id}</span>
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
          {showMilestone && milestone && (
            <Chip tone="accent" icon={<TbFlag size={12} style={{ color: 'var(--accent-fg)' }} />}>
              {milestone.name}
            </Chip>
          )}
          {showNote && snap.commit_message && (
            <span className={styles.futureRowNote}>{snap.commit_message}</span>
          )}
        </div>
        {canEdit && showActions && (
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
                  onClick: () => onApply(snap)
                },
                {
                  label: 'Edit',
                  icon: <TbPencil size={14} />,
                  onClick: () => onEdit(snap)
                },
                {
                  label: 'Remove',
                  icon: <TbTrash size={14} />,
                  danger: true,
                  onClick: () => onDelete(snap)
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
          <span className={styles.futureRowNoChanges}>No field changes</span>
        )}
      </div>
    </div>
  );
};
