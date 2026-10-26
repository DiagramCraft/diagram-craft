import { useCallback, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TbCalendarEvent, TbDots, TbFlag } from 'react-icons/tb';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { useWithdrawChangeCase } from '../../../hooks/useChangeCases';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { type ChangeCaseMemberEntry } from '../../entities/components/snapshotDisplay';
import { ProjectScreenLayout } from '../shared/ProjectScreenLayout';
import { ProjectPlanDiff } from './ProjectPlanDiff';
import { ProjectPlanPlannedChanges } from './ProjectPlanPlannedChanges';
import { ProjectPlanMilestones } from './ProjectPlanMilestones';
import { ProjectPlanTimeline } from './ProjectPlanTimeline';
import { usePlanChanges } from './usePlanChanges';
import styles from './ProjectPlan.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

type PlanTab = 'timeline' | 'planned-changes' | 'project-diff' | 'milestones';

export const ProjectPlan = ({
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
  onPlanChange,
  onApplySnapshot,
  onEditSnapshot
}: {
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
  onPlanChange: () => void;
  onApplySnapshot: (entry: ChangeCaseMemberEntry) => void;
  onEditSnapshot: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug, projects } = useWorkspaceContext();
  const withdrawChangeCaseMutation = useWithdrawChangeCase(workspaceSlug, project.id);
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChangeCaseMemberEntry | null>(null);

  const {
    changeEntries,
    plannedCount,
    milestonesById,
    diffTargetDate,
    relationNameById,
    relationSchemaById,
    relationSchemaIdByRelationId,
    entityNameById
  } = usePlanChanges({ workspaceSlug, project, projectEntities, changeCases });

  // Project Diff needs a target date; fall back to the default tab when there is none.
  const requestedTab: PlanTab = search.planTab ?? 'timeline';
  const activeTab: PlanTab =
    requestedTab === 'project-diff' && diffTargetDate == null ? 'timeline' : requestedTab;
  const setActiveTab = useCallback(
    (tab: PlanTab) => {
      navigate({ search: previous => ({ ...previous, planTab: tab }) });
    },
    [navigate]
  );

  const deleteTargetCaseEntityNames = deleteTarget
    ? changeEntries
        .filter(entry => entry.changeCase.id === deleteTarget.changeCase.id)
        .map(entry => entityNameById.get(entry.member.entity_id) ?? entry.member.entity_id)
    : [];

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await withdrawChangeCaseMutation.mutateAsync({ caseId: deleteTarget.changeCase.id });
    setDeleteTarget(null);
  };

  const menuItems: MenuItem[] = project.canEdit
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
    : [];

  const tabButton = (tab: PlanTab, label: string) => (
    <button
      type="button"
      className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </button>
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
      title="Plan"
      actions={
        project.canEdit ? (
          <Button variant="primary" icon={<TbCalendarEvent size={12} />} onClick={onPlanChange}>
            Plan change
          </Button>
        ) : undefined
      }
      menu={
        menuItems.length > 0 ? (
          <DropdownMenu
            trigger={<Button aria-label="Plan actions" icon={<TbDots size={14} />} />}
            items={menuItems}
          />
        ) : undefined
      }
      toolbar={
        <div className={styles.tabBar}>
          <div className={styles.tabNav}>
            {tabButton('timeline', 'Timeline')}
            {tabButton(
              'planned-changes',
              `Planned changes${plannedCount > 0 ? ` (${plannedCount})` : ''}`
            )}
            {diffTargetDate != null && tabButton('project-diff', 'Project Diff')}
            {tabButton('milestones', 'Milestones')}
          </div>
        </div>
      }
    >
      {activeTab === 'timeline' ? (
        <div className={styles.tab}>
          <ProjectPlanTimeline
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
      ) : activeTab === 'planned-changes' ? (
        <ProjectPlanPlannedChanges
          project={project}
          changeEntries={changeEntries}
          relationNameById={relationNameById}
          relationSchemaById={relationSchemaById}
          relationSchemaIdByRelationId={relationSchemaIdByRelationId}
          projectEntities={projectEntities}
          schemaMap={schemaMap}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          teams={teams}
          milestonesById={milestonesById}
          onApplySnapshot={onApplySnapshot}
          onEditSnapshot={onEditSnapshot}
          onDeleteSnapshot={setDeleteTarget}
        />
      ) : activeTab === 'milestones' ? (
        <ProjectPlanMilestones
          project={project}
          creating={isCreatingMilestone}
          onCreatingChange={setIsCreatingMilestone}
        />
      ) : (
        <div className={styles.tab}>
          <ProjectPlanDiff
            workspaceId={workspaceSlug}
            project={project}
            projects={projects}
            targetDate={diffTargetDate}
            schemaMap={schemaMap}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            teams={teams}
          />
        </div>
      )}
      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title="Delete planned change"
        message={
          deleteTargetCaseEntityNames.length > 1
            ? `Delete this planned change for ${deleteTargetCaseEntityNames.length} entities?`
            : 'Delete this planned change?'
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
