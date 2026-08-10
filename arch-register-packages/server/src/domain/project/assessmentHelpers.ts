import { randomUUID } from 'node:crypto';
import type {
  AssessmentDbCreate,
  AssessmentDbResult,
  AssessmentDbUpdate
} from './db/projectDatabase';
import { httpAssert } from '../../utils/httpAssert';
import {
  Assessment,
  AssessmentField,
  AssessmentGroup,
  AssessmentRecurrence
} from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { buildDerivedPlan } from '../derived/derivedFields';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import { visibleAssessmentScopeConditions } from './assessmentScopeAccess';

const toAssessmentFields = (value: unknown, fallback: AssessmentField[]) => {
  const fields = Array.isArray(value) ? (value as AssessmentField[]) : fallback;
  try {
    buildDerivedPlan(fields, 'assessment');
  } catch (error) {
    httpAssert.true(false, {
      status: 400,
      message: error instanceof Error ? error.message : String(error)
    });
  }
  return fields;
};

const toAssessmentGroups = (value: unknown, fallback: AssessmentGroup[]) =>
  Array.isArray(value) ? (value as AssessmentGroup[]) : fallback;

const clearOrphanedGroupIds = <F extends { groupId?: string }>(
  fields: F[],
  groups: AssessmentGroup[]
): F[] => {
  const groupIds = new Set(groups.map(group => group.id));
  return fields.map(field =>
    field.groupId && !groupIds.has(field.groupId) ? { ...field, groupId: undefined } : field
  );
};

const toScope = (value: unknown, fallback: string[]) =>
  Array.isArray(value) ? (value as string[]) : fallback;

const toScopeConditions = (value: unknown, fallback: FilterCondition[]) =>
  Array.isArray(value) ? (value as FilterCondition[]) : fallback;

const toAssessmentMode = (value: unknown, fallback: AssessmentDbResult['mode']) =>
  value === 'fields' || value === 'confirm' ? value : fallback;

const toAssignedTeamIds = (value: unknown, fallback: string[]) =>
  Array.isArray(value) ? (value as string[]) : fallback;

const toDueAt = (value: unknown, fallback: Date | null): Date | null => {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return typeof value === 'string' ? new Date(value) : fallback;
};

const isAssessmentRecurrence = (value: unknown): value is AssessmentRecurrence =>
  typeof value === 'object' &&
  value !== null &&
  ['none', 'weekly', 'monthly'].includes((value as { type?: unknown }).type as string);

const toAssessmentRecurrence = (
  value: unknown,
  fallback: AssessmentRecurrence
): AssessmentRecurrence => (isAssessmentRecurrence(value) ? value : fallback);

const toResponseWindowDays = (value: unknown, fallback: number | null): number | null => {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return typeof value === 'number' ? value : fallback;
};

export const buildCreateAssessmentInput = (
  workspace: string,
  body: Record<string, unknown>,
  timestamp: Date
): AssessmentDbCreate => {
  const {
    project_id,
    name,
    description,
    mode,
    assessment_type_id,
    scope,
    scope_conditions,
    fields,
    groups,
    assigned_team_ids,
    due_at,
    recurrence,
    response_window_days
  } = body;
  httpAssert.string(project_id, { message: 'project_id is required and must be a string' });
  httpAssert.string(name, { message: 'name is required and must be a string' });

  const normalizedGroups = toAssessmentGroups(groups, []);

  return {
    id: randomUUID(),
    workspace,
    project_id,
    name,
    description: typeof description === 'string' ? description : '',
    status: 'draft',
    mode: toAssessmentMode(mode, 'fields'),
    assessment_type_id:
      assessment_type_id === null || typeof assessment_type_id === 'string'
        ? (assessment_type_id ?? null)
        : null,
    scope: toScope(scope, []),
    scope_conditions: toScopeConditions(scope_conditions, []),
    fields: clearOrphanedGroupIds(toAssessmentFields(fields, []), normalizedGroups),
    groups: normalizedGroups,
    assigned_team_ids: toAssignedTeamIds(assigned_team_ids, []),
    due_at: toDueAt(due_at, null),
    recurrence: toAssessmentRecurrence(recurrence, { type: 'none' }),
    response_window_days: toResponseWindowDays(response_window_days, null),
    current_occurrence: 1,
    pending_occurrence_job_run_id: null,
    next_occurrence_at: null,
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateAssessmentInput = (
  body: Record<string, unknown>,
  existing: AssessmentDbResult,
  updatedAt: Date
): AssessmentDbUpdate => {
  const {
    name,
    description,
    mode,
    assessment_type_id,
    scope,
    scope_conditions,
    fields,
    groups,
    assigned_team_ids,
    due_at,
    recurrence,
    response_window_days
  } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  const normalizedGroups = toAssessmentGroups(groups, existing.groups ?? []);

  return {
    name,
    description: typeof description === 'string' ? description : existing.description,
    status: existing.status,
    mode: toAssessmentMode(mode, existing.mode),
    assessment_type_id:
      assessment_type_id === undefined
        ? existing.assessment_type_id
        : assessment_type_id === null || typeof assessment_type_id === 'string'
          ? assessment_type_id
          : existing.assessment_type_id,
    scope: toScope(scope, existing.scope),
    scope_conditions: toScopeConditions(scope_conditions, existing.scope_conditions),
    fields: clearOrphanedGroupIds(toAssessmentFields(fields, existing.fields), normalizedGroups),
    groups: normalizedGroups,
    assigned_team_ids: toAssignedTeamIds(assigned_team_ids, existing.assigned_team_ids),
    due_at: toDueAt(due_at, existing.due_at),
    recurrence: toAssessmentRecurrence(recurrence, existing.recurrence),
    response_window_days: toResponseWindowDays(response_window_days, existing.response_window_days),
    current_occurrence: existing.current_occurrence,
    pending_occurrence_job_run_id: existing.pending_occurrence_job_run_id,
    next_occurrence_at: existing.next_occurrence_at,
    updated_at: updatedAt
  };
};

export type AssessmentTeamAcknowledgeStatus = {
  team_id: string;
  team_name: string;
  status: 'open' | 'completed' | 'superseded';
  resolved_at: string | null;
};

export const toApiAssessment = (
  row: AssessmentDbResult,
  stats: {
    response_count: number;
    completed_entity_count: number;
    team_acknowledge_status?: AssessmentTeamAcknowledgeStatus[];
  },
  projectId: string,
  authCtx: WorkspaceAuthorizationContext | null = null,
  schemas: SchemaDbResult[] = []
): Assessment => ({
  id: row.id,
  workspace: row.workspace,
  project_id: projectId,
  name: row.name,
  description: row.description,
  status: row.status,
  mode: row.mode,
  assessment_type_id: row.assessment_type_id ?? null,
  scope: row.scope,
  scope_conditions: visibleAssessmentScopeConditions(row, schemas, authCtx),
  fields: row.fields,
  groups: row.groups,
  assigned_team_ids: row.assigned_team_ids,
  due_at: row.due_at ? row.due_at.toISOString() : null,
  recurrence: row.recurrence,
  response_window_days: row.response_window_days,
  current_occurrence: row.current_occurrence,
  next_occurrence_at: row.next_occurrence_at ? row.next_occurrence_at.toISOString() : null,
  response_count: stats.response_count,
  completed_entity_count: stats.completed_entity_count,
  team_acknowledge_status: stats.team_acknowledge_status ?? [],
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString()
});
