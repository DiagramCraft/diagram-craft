import styles from './ProjectDetailScreen.module.css';
import {
  asProjectPublicId,
  projectContentFolderRoute,
  projectDetailRoute
} from '../../routes/publicObjectRoutes';
import { ProjectContent } from './content/ProjectContent';
import { ProjectHome } from './home/ProjectHome';
import { ProjectEntities } from './entities/ProjectEntities';
import { ProjectPlan } from './plan/ProjectPlan';
import { BaselineDetailView } from '../baselines/BaselineDetailView';
import { ProjectAssessments } from './assessments/ProjectAssessments';
import { AssessmentDetailsScreen } from './assessments/AssessmentDetailsScreen';
import { AddEntityToProjectDialog } from './entities/AddEntityToProjectDialog';
import { PlanChangeDialog } from './plan/PlanChangeDialog';
import { ApplyChangeCaseDialog } from './plan/ApplyChangeCaseDialog';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { useProjectDetailController } from './useProjectDetailController';

export const ProjectDetailScreen = ({ folder }: { folder?: string } = {}) => {
  const {
    navigate,
    projectId,
    search,
    workspaceSlug,
    teams,
    projectEntityTypes,
    schemas,
    lifecycleStates,
    section,
    pendingDialog,
    contentFolderFilter,
    addEntityOpen,
    setAddEntityOpen,
    planDialog,
    setPlanDialog,
    applyCaseId,
    setApplyCaseId,
    project,
    isLoading,
    projectEntities,
    updateEntityMutation,
    removeEntityMutation,
    changeCases,
    entityTypeColorMap,
    allFiles,
    visibleFiles
  } = useProjectDetailController(folder);

  if (isLoading) {
    return (
      <div className={styles.screen}>
        <LoadingState text="Loading project..." />
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.screen}>
        <EmptyState framed title="Project not found" />
      </div>
    );
  }

  const closeAddEntityDialog = () => {
    setAddEntityOpen(false);
    if (pendingDialog !== 'add-entity') return;
    const nextSearch = {
      tab: search.tab === 'archive' ? search.tab : undefined,
      section: section === 'home' ? undefined : section,
      dialog: undefined,
      contentQuery: search.contentQuery,
      contentView: search.contentView
    };
    const nextLocation = folder
      ? projectContentFolderRoute(workspaceSlug, asProjectPublicId(projectId), folder, nextSearch)
      : projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), nextSearch);
    navigate({ ...nextLocation, replace: true });
  };

  return (
    <>
      {section === 'assessments' && search.assessmentId ? (
        <AssessmentDetailsScreen
          key={search.assessmentId}
          project={project}
          projectId={projectId}
          assessmentId={search.assessmentId}
          initialTab={search.assessmentTab}
          onBack={() =>
            navigate({
              ...(folder
                ? projectContentFolderRoute(workspaceSlug, asProjectPublicId(projectId), folder)
                : projectDetailRoute(workspaceSlug, asProjectPublicId(projectId))),
              search: { ...search, assessmentId: undefined }
            })
          }
        />
      ) : section === 'assessments' ? (
        <ProjectAssessments project={project} projectId={projectId} />
      ) : section === 'entities' && search.baselineId ? (
        <BaselineDetailView
          workspaceSlug={workspaceSlug}
          baselineId={search.baselineId}
          onDeleted={() =>
            navigate({
              ...projectDetailRoute(workspaceSlug, asProjectPublicId(project.id)),
              search: (previous: Record<string, unknown>) => ({
                ...previous,
                section: 'entities' as const,
                baselineId: undefined,
                sidebarTab: undefined,
                asOf: undefined,
                asOfIncludeProjects: undefined
              })
            })
          }
        />
      ) : section === 'entities' ? (
        <ProjectEntities
          project={project}
          projectEntities={projectEntities}
          changeCases={changeCases}
          entityTypeColorMap={entityTypeColorMap}
          onAddEntity={() => setAddEntityOpen(true)}
          onToggleDone={(entityId, isDone) =>
            updateEntityMutation.mutate({ entityId, is_done: !isDone })
          }
          onRemoveEntity={entityId => removeEntityMutation.mutate(entityId)}
          onPlanFutureChange={entityId => setPlanDialog({ mode: 'create', entityId })}
          onPlanChange={() => setPlanDialog({ mode: 'create' })}
        />
      ) : section === 'plan' ? (
        <ProjectPlan
          project={project}
          projectEntities={projectEntities}
          changeCases={changeCases}
          entityTypeColorMap={entityTypeColorMap}
          onPlanChange={() => setPlanDialog({ mode: 'create' })}
          onApplySnapshot={entry => setApplyCaseId(entry.changeCase.id)}
          onEditSnapshot={entry => setPlanDialog({ mode: 'edit', caseId: entry.changeCase.id })}
        />
      ) : contentFolderFilter ? (
        <ProjectContent
          project={project}
          folderPath={contentFolderFilter}
          visibleFiles={visibleFiles}
          allFilesCount={allFiles.length}
          folderCount={project.files.folders.length}
        />
      ) : (
        <ProjectHome
          project={project}
          allFilesCount={allFiles.length}
          folderCount={project.files.folders.length}
        />
      )}

      {addEntityOpen && (
        <AddEntityToProjectDialog
          open={addEntityOpen}
          onClose={closeAddEntityDialog}
          workspaceId={workspaceSlug}
          projectId={projectId}
          projectEntityTypes={projectEntityTypes}
        />
      )}

      {planDialog && (
        <PlanChangeDialog
          open={!!planDialog}
          workspaceId={workspaceSlug}
          projectId={projectId}
          schemas={schemas}
          teams={teams}
          lifecycleStates={lifecycleStates}
          initialEntityId={planDialog.mode === 'create' ? planDialog.entityId : undefined}
          editCaseId={planDialog.mode === 'edit' ? planDialog.caseId : undefined}
          onClose={() => setPlanDialog(null)}
        />
      )}

      {applyCaseId && (
        <ApplyChangeCaseDialog
          open={!!applyCaseId}
          workspaceId={workspaceSlug}
          projectId={projectId}
          caseId={applyCaseId}
          schemas={schemas}
          onClose={() => setApplyCaseId(null)}
        />
      )}
    </>
  );
};
