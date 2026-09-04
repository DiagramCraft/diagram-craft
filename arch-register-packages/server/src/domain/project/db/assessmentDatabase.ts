import type {
  AssessmentField,
  AssessmentGroup,
  AssessmentRecurrence
} from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export type AssessmentDbResult = {
  id: string;
  workspace: string;
  project_id: string;
  name: string;
  description: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
  mode: 'fields' | 'confirm';
  assessment_type_id?: string | null;
  scope: string[];
  scope_conditions: FilterCondition[];
  fields: AssessmentField[];
  groups: AssessmentGroup[];
  assigned_team_ids: string[];
  due_at: Date | null;
  recurrence: AssessmentRecurrence;
  response_window_days: number | null;
  current_occurrence: number;
  pending_occurrence_job_run_id: string | null;
  next_occurrence_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type AssessmentDbCreate = AssessmentDbResult;

export type AssessmentDbUpdate = Omit<
  AssessmentDbResult,
  'id' | 'workspace' | 'project_id' | 'created_at'
>;

export const assessmentMapper = (row: DatabaseRow): AssessmentDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  project_id: String(row['project_id']),
  name: String(row['name']),
  description: String(row['description'] ?? ''),
  status: row['status'] as AssessmentDbResult['status'],
  mode: (row['mode'] as AssessmentDbResult['mode']) ?? 'fields',
  assessment_type_id: row['assessment_type_id'] == null ? null : String(row['assessment_type_id']),
  scope: parseDatabaseJson(row['scope'], [], 'assessment.scope'),
  scope_conditions: parseDatabaseJson(row['scope_conditions'], [], 'assessment.scope_conditions'),
  fields: parseDatabaseJson(row['fields'], [], 'assessment.fields'),
  groups: parseDatabaseJson(row['groups'], [], 'assessment.groups'),
  assigned_team_ids: parseDatabaseJson(
    row['assigned_team_ids'],
    [],
    'assessment.assigned_team_ids'
  ),
  due_at: row['due_at'] == null ? null : databaseDate(row['due_at']),
  recurrence: parseDatabaseJson(row['recurrence'], { type: 'none' }, 'assessment.recurrence'),
  response_window_days:
    row['response_window_days'] == null ? null : Number(row['response_window_days']),
  current_occurrence: Number(row['current_occurrence'] ?? 1),
  pending_occurrence_job_run_id:
    row['pending_occurrence_job_run_id'] == null
      ? null
      : String(row['pending_occurrence_job_run_id']),
  next_occurrence_at:
    row['next_occurrence_at'] == null ? null : databaseDate(row['next_occurrence_at']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});

export type AssessmentDatabase = {
  listAssessments(ws: string): Promise<AssessmentDbResult[]>;
  getAssessment(ws: string, projectId: string, id: string): Promise<AssessmentDbResult | null>;
  getAssessmentById(ws: string, id: string): Promise<AssessmentDbResult | null>;
  createAssessment(input: AssessmentDbCreate): Promise<AssessmentDbResult>;
  updateAssessment(
    ws: string,
    projectId: string,
    id: string,
    input: AssessmentDbUpdate
  ): Promise<AssessmentDbResult | null>;
  deleteAssessment(ws: string, projectId: string, id: string): Promise<AssessmentDbResult | null>;
};
