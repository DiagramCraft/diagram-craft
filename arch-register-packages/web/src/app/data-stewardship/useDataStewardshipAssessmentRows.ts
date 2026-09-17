import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import { entitiesQuery } from '../../queries/entities';
import { assessmentsQuery, assessmentResponsesQuery } from '../../queries/assessments';
import { useAssessmentTypes } from '../../hooks/useWorkspaceConfig';
import { usePrincipalLabel } from '../../hooks/usePrincipalLabel';
import {
  deriveDataStewardshipAssessmentRows,
  deriveDataStewardshipAssessmentSummaries,
  type DataStewardshipAssessmentRow,
  type DataStewardshipAssessmentSummary
} from './dataStewardshipAssessments';

/**
 * Fetches every assessment scoped to the workspace's Data Entity schema, plus the in-scope dataset
 * entities and responses each one needs, and derives both the per-(assessment, dataset) row list
 * (`deriveDataStewardshipAssessmentRows` — the shared dataset drawer's data source, `rows` below)
 * and the one-row-per-assessment register summaries
 * (`deriveDataStewardshipAssessmentSummaries` — `sections/DataStewardshipAssessmentsScreen.tsx`'s
 * table grain, `summaries` below). Shared by both so the fetch logic lives in one place rather than
 * being duplicated between them.
 */
export const useDataStewardshipAssessmentRows = (
  workspaceSlug: string,
  dataEntitySchemaId: string | null,
  enabled = true
): {
  rows: DataStewardshipAssessmentRow[];
  summaries: DataStewardshipAssessmentSummary[];
  isLoading: boolean;
} => {
  const allAssessments = useQuery(
    assessmentsQuery(workspaceSlug, enabled && dataEntitySchemaId != null)
  );
  const assessmentTypes = useAssessmentTypes(workspaceSlug, enabled && dataEntitySchemaId != null);
  const principalLabel = usePrincipalLabel();

  const scopedAssessments = useMemo(
    () =>
      (allAssessments.data ?? []).filter(
        assessment => dataEntitySchemaId != null && assessment.scope.includes(dataEntitySchemaId)
      ),
    [allAssessments.data, dataEntitySchemaId]
  );

  // Each assessment can carry its own `scope_conditions`, so unlike a plain schema-wide entity
  // list, the in-scope dataset entities have to be fetched per assessment — one query per
  // assessment, same shape `useEntitiesBySchema` batches for a single shared `conditions` array,
  // but that helper doesn't fit here since `conditions` differ per assessment.
  const entityQueries = useQueries({
    queries: scopedAssessments.map(assessment =>
      entitiesQuery(
        workspaceSlug,
        {
          schemaId: dataEntitySchemaId,
          conditions: assessment.scope_conditions,
          view: 'full',
          limit: 500
        },
        dataEntitySchemaId != null
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
      deriveDataStewardshipAssessmentRows({
        assessments: scopedAssessments,
        entitiesByAssessmentId,
        responsesByAssessmentId,
        assessmentTypes: assessmentTypes.data ?? [],
        principalLabel
      }),
    [
      scopedAssessments,
      entitiesByAssessmentId,
      responsesByAssessmentId,
      assessmentTypes.data,
      principalLabel
    ]
  );

  const summaries = useMemo(
    () =>
      deriveDataStewardshipAssessmentSummaries({
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
