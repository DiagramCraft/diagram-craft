import { type CSSProperties, useCallback, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TbCalendarEvent, TbFlag } from 'react-icons/tb';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import { type MenuItem } from '../../../components/DropdownMenu';
import { TitleMenu } from '../../../components/TitleMenu';
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

// Panels fill the space below the tab bar; Tabs.Content defaults to a fixed height.
const TAB_CONTENT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  height: 'auto'
};

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

type PlanTab = 'timeline' | 'planned-changes' | 'project-diff' | 'milestones';

export const ProjectPlan = ({
  project,
  projectEntities,
  changeCases,
  entityTypeColorMap,
  onPlanChange,
  onApplySnapshot,
  onEditSnapshot
}: {
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  changeCases: ChangeCase[];
  entityTypeColorMap: Map<string, string>;
  onPlanChange: () => void;
  onApplySnapshot: (entry: ChangeCaseMemberEntry) => void;
  onEditSnapshot: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug, projects } = useWorkspaceContext();
  const withdrawChangeCaseMutation = useWithdrawChangeCase(workspaceSlug, project.id);
  const [milestoneEditorTarget, setMilestoneEditorTarget] = useState<Milestone | 'new' | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ChangeCaseMemberEntry | null>(null);

  const {
    entityEntries,
    changeEntries,
    plannedCount,
    milestonesById,
    diffTargetDate,
    relationNameById,
    relationSchemaById,
    relationSchemaIdByRelationId,
    entityNameById
  } = usePlanChanges({ workspaceId: workspaceSlug, project, projectEntities, changeCases });

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
            setMilestoneEditorTarget('new');
          }
        }
      ]
    : [];

  return (
    <ProjectScreenLayout
      projectName={project.name}
      title="Plan"
      actions={
        project.canEdit ? (
          <Button variant="primary" icon={<TbCalendarEvent size={12} />} onClick={onPlanChange}>
            Plan change
          </Button>
        ) : undefined
      }
      menu={menuItems.length > 0 ? <TitleMenu label="Plan actions" items={menuItems} /> : undefined}
    >
      <div className={styles.tabs}>
        <Tabs.Root value={activeTab} onValueChange={value => setActiveTab(value as PlanTab)}>
          <div className={styles.tabBar}>
            <Tabs.List>
              <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
              <Tabs.Trigger value="planned-changes">
                {`Planned changes${plannedCount > 0 ? ` (${plannedCount})` : ''}`}
              </Tabs.Trigger>
              {diffTargetDate != null && (
                <Tabs.Trigger value="project-diff">Project Diff</Tabs.Trigger>
              )}
              <Tabs.Trigger value="milestones">Milestones</Tabs.Trigger>
            </Tabs.List>
          </div>

          <Tabs.Content value="timeline" style={TAB_CONTENT_STYLE}>
            <div className={styles.tab}>
              <ProjectPlanTimeline
                project={project}
                projectEntities={projectEntities}
                entityEntries={entityEntries}
                entityTypeColorMap={entityTypeColorMap}
                milestonesById={milestonesById}
                canEdit={project.canEdit}
                onApplySnapshot={onApplySnapshot}
                onEditSnapshot={onEditSnapshot}
                onDeleteSnapshot={setDeleteTarget}
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="planned-changes" style={TAB_CONTENT_STYLE}>
            <ProjectPlanPlannedChanges
              project={project}
              changeEntries={changeEntries}
              relationNameById={relationNameById}
              relationSchemaById={relationSchemaById}
              relationSchemaIdByRelationId={relationSchemaIdByRelationId}
              projectEntities={projectEntities}
              milestonesById={milestonesById}
              onApplySnapshot={onApplySnapshot}
              onEditSnapshot={onEditSnapshot}
              onDeleteSnapshot={setDeleteTarget}
            />
          </Tabs.Content>

          {diffTargetDate != null && (
            <Tabs.Content value="project-diff" style={TAB_CONTENT_STYLE}>
              <div className={styles.tab}>
                <ProjectPlanDiff
                  workspaceId={workspaceSlug}
                  project={project}
                  projects={projects}
                  targetDate={diffTargetDate}
                />
              </div>
            </Tabs.Content>
          )}

          <Tabs.Content value="milestones" style={TAB_CONTENT_STYLE}>
            <ProjectPlanMilestones
              project={project}
              editorTarget={milestoneEditorTarget}
              onEditorTargetChange={setMilestoneEditorTarget}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>
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
