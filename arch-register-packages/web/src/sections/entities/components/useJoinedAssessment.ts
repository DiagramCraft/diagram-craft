import { useMemo } from 'react';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import { useAssessments } from '../../../hooks/useAssessments';
import { useAssessmentResponses } from '../../../hooks/useAssessmentResponses';

export type AssessmentJoinOption = {
  assessment: Assessment;
  projectId: string;
  projectName: string;
};

export const isJoinableAssessment = (assessment: Pick<Assessment, 'status'>) =>
  assessment.status === 'open' || assessment.status === 'closed';

export const getAssessmentProjectIds = (projects: Array<{ id: string }>, projectId?: string) =>
  projectId ? [projectId] : projects.map(project => project.id);

export const resolveJoinAssessmentId = (
  joinAssessmentId: string | null | undefined,
  options: AssessmentJoinOption[],
  projectId?: string
) => {
  if (!projectId) return joinAssessmentId ?? null;
  return options.some(option => option.assessment.id === joinAssessmentId)
    ? (joinAssessmentId ?? null)
    : null;
};

/**
 * Open or closed assessments that can be joined into the entity browser, narrowed to one project
 * when `projectId` is given. `projectId` is the project's internal id, as on `assessment.project_id`.
 */
export const buildAssessmentJoinOptions = (
  assessments: Assessment[],
  projects: Array<Pick<Project, 'id' | 'name'>>,
  projectId?: string
): AssessmentJoinOption[] =>
  assessments
    .filter(assessment => isJoinableAssessment(assessment))
    .filter(assessment => !projectId || assessment.project_id === projectId)
    .map(assessment => ({
      assessment,
      projectId: assessment.project_id,
      projectName: projects.find(project => project.id === assessment.project_id)?.name ?? ''
    }));

export const useJoinedAssessment = (
  workspaceId: string,
  joinAssessmentId: string | null | undefined,
  projectId: string | undefined,
  projects: Project[],
  enabled: boolean
) => {
  const { data: assessments = [], isLoading, isSuccess } = useAssessments(workspaceId, enabled);

  const options = useMemo(
    () => buildAssessmentJoinOptions(assessments, projects, projectId),
    [assessments, projectId, projects]
  );

  const joined = useMemo(
    () =>
      resolveJoinAssessmentId(joinAssessmentId, options, projectId)
        ? (options.find(o => o.assessment.id === joinAssessmentId) ?? null)
        : null,
    [options, joinAssessmentId, projectId]
  );

  const { data: responses = [] } = useAssessmentResponses(workspaceId, joined?.assessment.id ?? '');

  const responsesByEntity = useMemo(
    () => new Map(responses.map(r => [r.entity_id, r.values])),
    [responses]
  );

  return { options, joined, responsesByEntity, isLoading, isReady: isSuccess };
};
