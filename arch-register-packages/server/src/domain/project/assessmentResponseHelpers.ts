import type { AssessmentDbResult, AssessmentResponseDbResult } from './db/projectDatabase';
import type { EntityDbResult } from '../catalog/db/catalogDatabase';
import type { WorkspaceEnumDbResult } from '../catalog/db/catalogDatabase';
import { matchesFilterCondition } from '../catalog/dataHelpers';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';

export const toApiAssessmentResponse = (
  row: AssessmentResponseDbResult,
  assessment: AssessmentDbResult
): AssessmentResponse => ({
  id: row.id,
  entity_id: row.entity_id,
  values: row.values,
  status: computeAssessmentStatus(assessment.fields, row.values),
  updated_at: row.updated_at.toISOString(),
  updated_by: row.updated_by,
  updated_by_name: row.updated_by_name
});

export const countCompletedEntities = (
  responses: AssessmentResponseDbResult[],
  assessment: AssessmentDbResult
): number =>
  responses.filter(r => computeAssessmentStatus(assessment.fields, r.values) === 'complete').length;

const CSV_COLUMNS_STATIC_HEAD = ['Entity', 'Owner', 'Schema Type'];
const CSV_COLUMNS_STATIC_TAIL = ['Status'];

export const isEntityInAssessmentScope = (
  entity: EntityDbResult,
  assessment: AssessmentDbResult
): boolean =>
  assessment.scope.includes(entity.schema_id) &&
  assessment.scope_conditions.every(condition => matchesFilterCondition(entity, condition, null));

export const buildAssessmentResultsCsvData = (
  entities: EntityDbResult[],
  responses: AssessmentResponseDbResult[],
  assessment: AssessmentDbResult,
  enums: WorkspaceEnumDbResult[]
): { columns: string[]; rows: Record<string, unknown>[] } => {
  const responseByEntity = new Map(responses.map(r => [r.entity_id, r]));
  const enumOptionLabel = (enumId: string, value: string) =>
    enums.find(e => e.id === enumId)?.options.find(o => o.value === value)?.label ?? value;

  const columns = [
    ...CSV_COLUMNS_STATIC_HEAD,
    ...assessment.fields.map(f => f.label),
    ...CSV_COLUMNS_STATIC_TAIL
  ];

  const rows = entities
    .filter(entity => isEntityInAssessmentScope(entity, assessment))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entity => {
      const response = responseByEntity.get(entity.id);
      const values = response?.values ?? {};
      const row: Record<string, unknown> = {
        'Entity': entity.name || entity.slug,
        'Owner': entity.owner_name ?? '',
        'Schema Type': entity.schema_name,
        'Status': response ? toApiAssessmentResponse(response, assessment).status : 'not_started'
      };
      for (const field of assessment.fields) {
        const value = values[field.id];
        if (value === undefined) {
          row[field.label] = '';
        } else if (field.type === 'enum') {
          row[field.label] = enumOptionLabel(field.enumId, String(value));
        } else {
          row[field.label] = value;
        }
      }
      return row;
    });

  return { columns, rows };
};
