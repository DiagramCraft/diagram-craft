import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useCreateAssessment,
  useProjectAssessments,
  useUpdateAssessmentStatus
} from '../../hooks/useAssessments';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import {
  AssessmentList,
  AssessmentListToolbar,
  type StatusFilter
} from './components/AssessmentList';
import { AssessmentEditorDialog } from './components/AssessmentEditorDialog';
import type { AssessmentFormData } from './components/assessmentEditorState';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

export const ProjectAssessments = ({
  project,
  projectId,
  onNavigateHome,
  onNavigateProject
}: {
  project: ProjectDetailData;
  // The raw project route param (may be the public id) remains distinct from project.id so the
  // query key stays aligned with ProjectContentSidebar.
  projectId: string;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
}) => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { data: assessments = [] } = useProjectAssessments(workspaceSlug, projectId);
  const createMutation = useCreateAssessment(workspaceSlug, projectId);
  const statusMutation = useUpdateAssessmentStatus(workspaceSlug, projectId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('default');
  const [creating, setCreating] = useState(false);

  const counts: Record<StatusFilter, number> = {
    default: assessments.filter(
      assessment => assessment.status === 'open' || assessment.status === 'closed'
    ).length,
    draft: assessments.filter(assessment => assessment.status === 'draft').length,
    archived: assessments.filter(assessment => assessment.status === 'archived').length,
    all: assessments.length
  };

  const handleSave = async (data: AssessmentFormData, status: Assessment['status']) => {
    const created = await createMutation.mutateAsync(data);
    if (status !== created.status) {
      await statusMutation.mutateAsync({ assessmentId: created.id, status });
    }
    setCreating(false);
  };

  return (
    <>
      <ProjectScreenLayout
        breadcrumbs={[
          {
            label: 'Home',
            onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
          },
          { label: 'Projects', onClick: onNavigateHome },
          { label: project.name, onClick: onNavigateProject }
        ]}
        title="Assessments"
        actions={
          project.canEdit ? (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setCreating(true)}>
              New assessment
            </Button>
          ) : undefined
        }
        toolbar={
          <AssessmentListToolbar
            statusFilter={statusFilter}
            counts={counts}
            onStatusFilterChange={setStatusFilter}
          />
        }
      >
        <AssessmentList
          assessments={assessments}
          statusFilter={statusFilter}
          schemas={schemas}
          canEdit={project.canEdit}
          onCreate={() => setCreating(true)}
          onOpen={assessmentId =>
            navigate({
              search: previous => ({
                ...previous,
                assessmentId
              })
            })
          }
        />
      </ProjectScreenLayout>

      {creating && (
        <AssessmentEditorDialog
          assessment={null}
          schemas={schemas}
          isSaving={createMutation.isPending}
          onSave={handleSave}
          onCancel={() => setCreating(false)}
        />
      )}
    </>
  );
};
