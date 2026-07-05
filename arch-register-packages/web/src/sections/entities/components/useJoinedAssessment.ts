import { useMemo } from 'react';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { useProjects } from '../../../hooks/useProjects';
import { useAssessmentsForProjects } from '../../../hooks/useAssessments';
import { useAssessmentResponses } from '../../../hooks/useAssessmentResponses';

export type AssessmentJoinOption = {
  assessment: Assessment;
  projectId: string;
  projectName: string;
};

/**
 * Resolves the entity browser's single joined assessment: the picker's candidate list
 * (open/closed assessments across every project the user can read, same resolution as
 * EntityAssessmentsTab) plus, when joined, the bulk entity_id -> values response map for
 * display. Fetches responses once via the existing assessmentResponses.list endpoint —
 * never per-entity.
 */
export const useJoinedAssessment = (workspaceId: string, joinAssessmentId: string | null | undefined) => {
  const { data: projects = [] } = useProjects(workspaceId);
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const assessmentQueries = useAssessmentsForProjects(workspaceId, projectIds);

  const options = useMemo<AssessmentJoinOption[]>(() => {
    const result: AssessmentJoinOption[] = [];
    assessmentQueries.forEach((q, i) => {
      const projectId = projectIds[i];
      const projectName = projects[i]?.name ?? '';
      (q.data ?? []).forEach(assessment => {
        if (assessment.status === 'open' || assessment.status === 'closed') {
          result.push({ assessment, projectId: projectId!, projectName });
        }
      });
    });
    return result;
  }, [assessmentQueries, projectIds, projects]);

  const joined = useMemo(
    () => (joinAssessmentId ? (options.find(o => o.assessment.id === joinAssessmentId) ?? null) : null),
    [options, joinAssessmentId]
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

  return { options, joined, responsesByEntity };
};
