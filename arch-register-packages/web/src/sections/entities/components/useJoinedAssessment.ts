import { useMemo } from 'react';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { useProjects } from '../../../hooks/useProjects';
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

export const useJoinedAssessment = (
  workspaceId: string,
  joinAssessmentId: string | null | undefined,
  projectId?: string
) => {
  const { data: projects = [] } = useProjects(workspaceId);
  const { data: assessments = [], isSuccess } = useAssessments(workspaceId);

  const options = useMemo<AssessmentJoinOption[]>(() => {
    const activeProject = projects.find(project => project.public_id === projectId);
    return assessments
      .filter(assessment => isJoinableAssessment(assessment))
      .filter(assessment => !projectId || assessment.project_id === activeProject?.id)
      .map(assessment => ({
        assessment,
        projectId: assessment.project_id,
        projectName: projects.find(project => project.id === assessment.project_id)?.name ?? ''
      }));
  }, [assessments, projectId, projects]);

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

  return { options, joined, responsesByEntity, isReady: isSuccess };
};
