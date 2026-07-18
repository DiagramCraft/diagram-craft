import { useMemo } from 'react';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { Project } from '@arch-register/api-types/projectContract';
import { useProjects } from '../../../hooks/useProjects';
import { useAssessmentsForProjects } from '../../../hooks/useAssessments';
import { useAssessmentResponses } from '../../../hooks/useAssessmentResponses';

export type AssessmentJoinOption = {
  assessment: Assessment;
  projectId: string;
  projectName: string;
};

export const isJoinableAssessment = (assessment: Pick<Assessment, 'status'>) =>
  assessment.status === 'open' || assessment.status === 'closed';

export const getAssessmentProjectIds = (
  projects: Pick<Project, 'id'>[],
  projectId?: string
) => (projectId ? [projectId] : projects.map(project => project.id));

export const resolveJoinAssessmentId = (
  joinAssessmentId: string | null | undefined,
  options: AssessmentJoinOption[],
  projectId?: string
) => {
  if (!projectId) return joinAssessmentId ?? null;
  return options.some(option => option.assessment.id === joinAssessmentId)
    ? joinAssessmentId ?? null
    : null;
};

/**
 * Resolves the entity browser's single joined assessment: the picker's candidate list
 * (open/closed assessments across every project the user can read in workspace context, or
 * only the active project in project context) plus, when joined, the bulk entity_id -> values
 * response map for display. Fetches responses once via the existing assessmentResponses.list
 * endpoint — never per-entity.
 */
export const useJoinedAssessment = (
  workspaceId: string,
  joinAssessmentId: string | null | undefined,
  projectId?: string
) => {
  const { data: projects = [] } = useProjects(workspaceId);
  const projectIds = useMemo(
    () => getAssessmentProjectIds(projects, projectId),
    [projectId, projects]
  );
  const assessmentQueries = useAssessmentsForProjects(workspaceId, projectIds);

  const options = useMemo<AssessmentJoinOption[]>(() => {
    const result: AssessmentJoinOption[] = [];
    assessmentQueries.forEach((q, i) => {
      const assessmentProjectId = projectIds[i];
      const project = projects.find(
        candidate =>
          candidate.id === assessmentProjectId || candidate.public_id === assessmentProjectId
      );
      (q.data ?? []).forEach(assessment => {
        if (isJoinableAssessment(assessment)) {
          result.push({
            assessment,
            projectId: assessmentProjectId!,
            projectName: project?.name ?? ''
          });
        }
      });
    });
    return result;
  }, [assessmentQueries, projectIds, projects]);

  const joined = useMemo(
    () =>
      resolveJoinAssessmentId(joinAssessmentId, options, projectId)
        ? (options.find(o => o.assessment.id === joinAssessmentId) ?? null)
        : null,
    [options, joinAssessmentId, projectId]
  );

  const { data: responses = [] } = useAssessmentResponses(
    workspaceId,
    joined?.projectId ?? '',
    joined?.assessment.id ?? ''
  );

  const responsesByEntity = useMemo(
    () => new Map(responses.map(r => [r.entity_id, r.values])),
    [responses]
  );

  return {
    options,
    joined,
    responsesByEntity,
    isReady: projectIds.length === 0 || assessmentQueries.every(query => query.isSuccess)
  };
};
