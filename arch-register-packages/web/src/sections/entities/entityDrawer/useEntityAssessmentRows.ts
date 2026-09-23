import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import { entitiesQuery } from '../../../queries/entities';
import { assessmentsQuery, assessmentResponsesQuery } from '../../../queries/assessments';
import { useAssessmentTypes } from '../../../hooks/useWorkspaceConfig';
import {
  deriveEntityAssessmentRows,
  deriveEntityAssessmentSummaries,
  type EntityAssessmentRow,
  type EntityAssessmentSummary
} from './entityAssessments';

/** Fetches and joins assessments targeting one entity schema for both entity drawers and
 * application-specific assessment registers. */
export const useEntityAssessmentRows = (
  workspaceSlug: string,
  entitySchemaId: string | null,
  enabled = true
): {
  rows: EntityAssessmentRow[];
  summaries: EntityAssessmentSummary[];
  isLoading: boolean;
} => {
  const allAssessments = useQuery(
    assessmentsQuery(workspaceSlug, enabled && entitySchemaId != null)
  );
  const assessmentTypes = useAssessmentTypes(workspaceSlug, enabled && entitySchemaId != null);

  const scopedAssessments = useMemo(
    () =>
      (allAssessments.data ?? []).filter(
        assessment => entitySchemaId != null && assessment.scope.includes(entitySchemaId)
      ),
    [allAssessments.data, entitySchemaId]
  );

  const entityQueries = useQueries({
    queries: scopedAssessments.map(assessment =>
      entitiesQuery(
        workspaceSlug,
        {
          schemaId: entitySchemaId,
          conditions: assessment.scope_conditions,
          view: 'full',
          limit: 500
        },
        entitySchemaId != null
      )
    )
  });
  const responseQueries = useQueries({
    queries: scopedAssessments.map(assessment =>
      assessmentResponsesQuery(workspaceSlug, assessment.id)
    )
  });

  const entitiesByAssessmentId = useMemo(() => {
    const map = new Map<string, EntityRecord[]>();
    scopedAssessments.forEach((assessment, index) => {
      map.set(assessment.id, (entityQueries[index]?.data?.items as EntityRecord[]) ?? []);
    });
    return map;
  }, [scopedAssessments, entityQueries]);

  const responsesByAssessmentId = useMemo(() => {
    const map = new Map<string, AssessmentResponse[]>();
    scopedAssessments.forEach((assessment, index) => {
      map.set(assessment.id, responseQueries[index]?.data ?? []);
    });
    return map;
  }, [scopedAssessments, responseQueries]);

  const rows = useMemo(
    () =>
      deriveEntityAssessmentRows({
        assessments: scopedAssessments,
        entitiesByAssessmentId,
        responsesByAssessmentId,
        assessmentTypes: assessmentTypes.data ?? []
      }),
    [scopedAssessments, entitiesByAssessmentId, responsesByAssessmentId, assessmentTypes.data]
  );

  const summaries = useMemo(
    () =>
      deriveEntityAssessmentSummaries({
        assessments: scopedAssessments,
        entitiesByAssessmentId,
        assessmentTypes: assessmentTypes.data ?? []
      }),
    [scopedAssessments, entitiesByAssessmentId, assessmentTypes.data]
  );

  const isLoading =
    allAssessments.isLoading ||
    entityQueries.some(query => query.isLoading) ||
    responseQueries.some(query => query.isLoading);

  return { rows, summaries, isLoading };
};
