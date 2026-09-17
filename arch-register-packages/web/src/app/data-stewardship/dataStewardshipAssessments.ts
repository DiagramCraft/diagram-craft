import type { Assessment, AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { type PrincipalValue } from '../../hooks/usePrincipalLabel';

/**
 * The four buckets `DataStewardshipAssessmentsScreen.tsx`'s stat strip and status column use —
 * mirrors the Claude Design reference's `DS_AT_TONE` keys (`ds-views.jsx`'s `DSAssessments`,
 * `ds-data.jsx`'s `DS_ASSESSMENTS`) exactly, except the design's "Open findings" stat has no analog
 * anywhere on the shipped `Assessment`/`AssessmentResponse` model (confirmed by a full-repo search;
 * the sibling `RiskComplianceAssessmentsScreen.tsx` hit the same gap for "Kind/Owner/Findings/Opened"
 * and dropped them rather than inventing a value) — dropped here too, in favour of promoting "Not
 * started" to its own tile, which keeps the strip a genuine 4-way partition of every row rather than
 * a 3-tile strip with an invented fourth number.
 */
export type DataStewardshipAssessmentStatus =
  | 'overdue'
  | 'in_progress'
  | 'not_started'
  | 'complete';

export const DS_ASSESSMENT_STATUS_LABEL: Record<DataStewardshipAssessmentStatus, string> = {
  overdue: 'Overdue',
  in_progress: 'In progress',
  not_started: 'Not started',
  complete: 'Complete'
};

/** One (assessment, dataset entity) pair — the row grain the design reference's `DS_ASSESSMENTS`
 *  uses (each mock assessment record already carries a single `dataset` id). The real generic
 *  `Assessment` model scopes a whole entity *schema*, not one entity, so producing this grain means
 *  joining every assessment in scope against every dataset entity it targets. */
export type DataStewardshipAssessmentRow = {
  assessment: Assessment;
  entity: EntityRecord;
  /** Workspace-managed assessment type name (`assessment_type_id` looked up against
   *  `AssessmentType[]`), or 'Uncategorized' when unset — same fallback
   *  `AssessmentEditorTabs.tsx`'s type picker uses. */
  kind: string;
  /** The dataset's steward, falling back to its business owner — cross-checked against the design
   *  reference's mock data, where an assessment's `owner` consistently matches the target dataset's
   *  steward (or its owner when there is no steward). Not a field on `Assessment` itself, same "no
   *  analog" gap `RiskComplianceAssessmentsScreen.tsx` documents for "Owner". */
  ownerLabel: string | null;
  /** Fraction of required fields answered (0-1) — the tri-state `computeAssessmentStatus` alone
   *  can't give a progress-bar percentage. */
  percent: number;
  status: DataStewardshipAssessmentStatus;
  questions: number;
  due: string | null;
  response: AssessmentResponse | undefined;
};

const isAnswered = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

/** Mirrors `computeAssessmentStatus`'s internal required-fields count (`assessmentStatus.ts`), but
 *  returns the fraction answered rather than collapsing it to a tri-state. */
const computeAssessmentPercent = (
  fields: AssessmentField[],
  values: Record<string, unknown> | undefined,
  mode: Assessment['mode']
): number => {
  if (mode === 'confirm') return values !== undefined ? 1 : 0;
  const requiredFields = fields.filter(
    field => field.type !== 'derived' && field.requirementLevel === 'required'
  );
  if (requiredFields.length === 0) return values !== undefined ? 1 : 0;
  const answered = requiredFields.filter(field => isAnswered(values?.[field.id])).length;
  return answered / requiredFields.length;
};

const assessmentIsPastDue = (assessment: Assessment): boolean =>
  assessment.status === 'open' &&
  assessment.due_at !== null &&
  assessment.due_at < new Date().toISOString();

/** One row per assessment — the register grain `DataStewardshipAssessmentsScreen.tsx`'s table
 *  actually renders, mirroring `../risk-compliance/sections/RiskComplianceAssessmentsScreen.tsx`'s
 *  own one-row-per-assessment register. The per-(assessment, dataset) join
 *  (`deriveDataStewardshipAssessmentRows` above) stays as the shared dataset drawer's data source
 *  (`DatasetDrawer.tsx`, where "this dataset's status on this assessment" is exactly what's wanted)
 *  but reads as a confusing, arbitrarily-repeated "progress" per row when surfaced as the main
 *  register's grain for an assessment spanning several datasets — one row, one aggregate progress
 *  bar reads far more clearly there. */
export type DataStewardshipAssessmentSummary = {
  assessment: Assessment;
  kind: string;
  /** Fraction of in-scope datasets with a complete response (`completed_entity_count` /
   *  in-scope count) — the same ratio `RiskComplianceAssessmentsScreen.tsx`'s own progress bar
   *  uses, server-computed on `Assessment` rather than re-derived from individual responses. */
  percent: number;
  status: DataStewardshipAssessmentStatus;
  questions: number;
  due: string | null;
  /** Number of datasets this assessment is scoped to — not rendered as its own column, but used to
   *  compute `percent` and to skip assessments with nothing in scope. */
  inScopeCount: number;
};

export const deriveDataStewardshipAssessmentSummaries = ({
  assessments,
  entitiesByAssessmentId,
  assessmentTypes
}: {
  assessments: Assessment[];
  entitiesByAssessmentId: Map<string, EntityRecord[]>;
  assessmentTypes: AssessmentType[];
}): DataStewardshipAssessmentSummary[] => {
  const summaries: DataStewardshipAssessmentSummary[] = [];
  for (const assessment of assessments) {
    const inScopeCount = entitiesByAssessmentId.get(assessment.id)?.length ?? 0;
    if (inScopeCount === 0) continue;
    const kind =
      assessmentTypes.find(type => type.id === assessment.assessment_type_id)?.name ??
      'Uncategorized';
    const complete = assessment.completed_entity_count >= inScopeCount;
    const status: DataStewardshipAssessmentStatus = complete
      ? 'complete'
      : assessmentIsPastDue(assessment)
        ? 'overdue'
        : assessment.completed_entity_count > 0
          ? 'in_progress'
          : 'not_started';

    summaries.push({
      assessment,
      kind,
      percent: assessment.completed_entity_count / inScopeCount,
      status,
      questions: assessment.fields.length,
      due: assessment.due_at,
      inScopeCount
    });
  }
  return summaries;
};

export const deriveDataStewardshipAssessmentRows = ({
  assessments,
  entitiesByAssessmentId,
  responsesByAssessmentId,
  assessmentTypes,
  principalLabel
}: {
  assessments: Assessment[];
  entitiesByAssessmentId: Map<string, EntityRecord[]>;
  responsesByAssessmentId: Map<string, AssessmentResponse[]>;
  assessmentTypes: AssessmentType[];
  principalLabel: (principal: PrincipalValue) => string | undefined;
}): DataStewardshipAssessmentRow[] => {
  const rows: DataStewardshipAssessmentRow[] = [];
  for (const assessment of assessments) {
    const entities = entitiesByAssessmentId.get(assessment.id) ?? [];
    if (entities.length === 0) continue;
    const responseByEntity = new Map(
      (responsesByAssessmentId.get(assessment.id) ?? []).map(response => [
        response.entity_id,
        response
      ])
    );
    const kind =
      assessmentTypes.find(type => type.id === assessment.assessment_type_id)?.name ??
      'Uncategorized';
    const pastDue = assessmentIsPastDue(assessment);

    for (const entity of entities) {
      const response = responseByEntity.get(entity._uid);
      const entityStatus = computeAssessmentStatus(
        assessment.fields,
        response?.values,
        assessment.mode
      );
      const status: DataStewardshipAssessmentStatus =
        pastDue && entityStatus !== 'complete' ? 'overdue' : entityStatus;
      const ownerLabel =
        principalLabel(entity.steward as PrincipalValue) ?? entity._owner?.name ?? null;

      rows.push({
        assessment,
        entity,
        kind,
        ownerLabel,
        percent: computeAssessmentPercent(assessment.fields, response?.values, assessment.mode),
        status,
        questions: assessment.fields.length,
        due: assessment.due_at,
        response
      });
    }
  }
  return rows;
};
