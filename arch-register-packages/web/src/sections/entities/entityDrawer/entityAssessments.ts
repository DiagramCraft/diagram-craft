import type { Assessment, AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';

export type EntityAssessmentStatus = 'overdue' | 'in_progress' | 'not_started' | 'complete';

export const ENTITY_ASSESSMENT_STATUS_LABEL: Record<EntityAssessmentStatus, string> = {
  overdue: 'Overdue',
  in_progress: 'In progress',
  not_started: 'Not started',
  complete: 'Complete'
};

export type EntityAssessmentRow = {
  assessment: Assessment;
  entity: EntityRecord;
  kind: string;
  percent: number;
  status: EntityAssessmentStatus;
  questions: number;
  due: string | null;
  response: AssessmentResponse | undefined;
};

export type EntityAssessmentSummary = {
  assessment: Assessment;
  kind: string;
  percent: number;
  status: EntityAssessmentStatus;
  questions: number;
  due: string | null;
  inScopeCount: number;
};

const isAnswered = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

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

export const deriveEntityAssessmentSummaries = ({
  assessments,
  entitiesByAssessmentId,
  assessmentTypes
}: {
  assessments: Assessment[];
  entitiesByAssessmentId: Map<string, EntityRecord[]>;
  assessmentTypes: AssessmentType[];
}): EntityAssessmentSummary[] => {
  const summaries: EntityAssessmentSummary[] = [];
  for (const assessment of assessments) {
    const inScopeCount = entitiesByAssessmentId.get(assessment.id)?.length ?? 0;
    if (inScopeCount === 0) continue;
    const kind =
      assessmentTypes.find(type => type.id === assessment.assessment_type_id)?.name ??
      'Uncategorized';
    const complete = assessment.completed_entity_count >= inScopeCount;
    const status: EntityAssessmentStatus = complete
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

export const deriveEntityAssessmentRows = ({
  assessments,
  entitiesByAssessmentId,
  responsesByAssessmentId,
  assessmentTypes
}: {
  assessments: Assessment[];
  entitiesByAssessmentId: Map<string, EntityRecord[]>;
  responsesByAssessmentId: Map<string, AssessmentResponse[]>;
  assessmentTypes: AssessmentType[];
}): EntityAssessmentRow[] => {
  const rows: EntityAssessmentRow[] = [];
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
      const status: EntityAssessmentStatus =
        pastDue && entityStatus !== 'complete' ? 'overdue' : entityStatus;

      rows.push({
        assessment,
        entity,
        kind,
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
