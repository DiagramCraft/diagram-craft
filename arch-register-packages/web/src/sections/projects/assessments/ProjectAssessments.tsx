import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  useCreateAssessment,
  useProjectAssessments,
  useUpdateAssessmentStatus
} from '../../../hooks/useAssessments';
import { ProjectScreenLayout } from '../shared/ProjectScreenLayout';
import { AssessmentTable } from './AssessmentTable';
import {
  matchesAssessmentListFilter,
  type AssessmentListFilter
} from '../../../lib/assessmentStatus';
import { LoadingState } from '../../../components/LoadingState';
import { ToolbarFilterBar, ToolbarFilterSelect } from '../../../components/ToolbarFilter';
import { AssessmentEditorDialog } from './AssessmentEditorDialog';
import type { AssessmentFormData } from './assessmentEditorState';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

export const ProjectAssessments = ({
  project,
  projectId
}: {
  project: ProjectDetailData;
  // The raw project route param (may be the public id) remains distinct from project.id so the
  // query key stays aligned with ProjectContentSidebar.
  projectId: string;
}) => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { data: assessments = [], isLoading } = useProjectAssessments(workspaceSlug, projectId);
  const createMutation = useCreateAssessment(workspaceSlug, projectId);
  const statusMutation = useUpdateAssessmentStatus(workspaceSlug, projectId);
  const [statusFilter, setStatusFilter] = useState<AssessmentListFilter>('default');
  const [creating, setCreating] = useState(false);

  const count = (filter: AssessmentListFilter) =>
    assessments.filter(assessment => matchesAssessmentListFilter(assessment, filter)).length;

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
        projectName={project.name}
        title="Assessments"
        actions={
          project.canEdit ? (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setCreating(true)}>
              New assessment
            </Button>
          ) : undefined
        }
        toolbar={
          <ToolbarFilterBar>
            <ToolbarFilterSelect
              label="Status"
              value={statusFilter}
              onChange={value => setStatusFilter(value as AssessmentListFilter)}
              options={[
                { value: 'default', label: `Open / Closed (${count('default')})` },
                { value: 'draft', label: `Draft (${count('draft')})` },
                { value: 'archived', label: `Archived (${count('archived')})` },
                { value: 'all', label: `All (${count('all')})` }
              ]}
            />
          </ToolbarFilterBar>
        }
      >
        {isLoading ? (
          <LoadingState text="Loading assessments…" />
        ) : (
          <AssessmentTable
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
        )}
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
