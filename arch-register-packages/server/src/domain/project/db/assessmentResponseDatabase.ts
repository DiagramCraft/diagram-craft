import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export const ASSESSMENT_RESPONSE_SELECT_SQL = `
  SELECT ar.*, u.display_name as updated_by_name
  FROM assessment_response ar
  LEFT JOIN users u ON u.id = ar.updated_by
`;

export type AssessmentResponseDbResult = {
  id: string;
  workspace: string;
  assessment_id: string;
  entity_id: string;
  occurrence: number;
  values: Record<string, string | number | boolean>;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
  updated_by_name: string | null;
};

export type AssessmentResponseDbUpsert = Omit<
  AssessmentResponseDbResult,
  'id' | 'created_at' | 'updated_at' | 'updated_by_name'
>;

export const assessmentResponseMapper = (row: DatabaseRow): AssessmentResponseDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  assessment_id: String(row['assessment_id']),
  entity_id: String(row['entity_id']),
  occurrence: Number(row['occurrence'] ?? 1),
  values: parseDatabaseJson(row['values'], {}, 'assessment_response.values'),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at']),
  updated_by: row['updated_by'] == null ? null : String(row['updated_by']),
  updated_by_name: row['updated_by_name'] == null ? null : String(row['updated_by_name'])
});

export type AssessmentResponseDatabase = {
  listAssessmentResponses(
    ws: string,
    assessmentId: string,
    occurrence: number
  ): Promise<AssessmentResponseDbResult[]>;
  listAllAssessmentResponses(
    ws: string,
    assessmentId: string
  ): Promise<AssessmentResponseDbResult[]>;
  getAssessmentResponse(
    ws: string,
    assessmentId: string,
    entityId: string,
    occurrence: number
  ): Promise<AssessmentResponseDbResult | null>;
  upsertAssessmentResponse(input: AssessmentResponseDbUpsert): Promise<AssessmentResponseDbResult>;
  updateAssessmentResponseDerivedFields(
    ws: string,
    assessmentId: string,
    entityId: string,
    occurrence: number,
    values: Record<string, string | number | boolean>
  ): Promise<void>;
  countAssessmentResponses(ws: string, assessmentId: string): Promise<number>;
};
