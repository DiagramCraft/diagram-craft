import { randomUUID } from 'node:crypto';
import type { AssessmentDbCreate, AssessmentDbResult, AssessmentDbUpdate } from './db/projectDatabase';
import { httpAssert } from '../../utils/httpAssert';
import { Assessment, AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

const toAssessmentFields = (value: unknown, fallback: AssessmentField[]) =>
  Array.isArray(value) ? (value as AssessmentField[]) : fallback;

const toScope = (value: unknown, fallback: string[]) =>
  Array.isArray(value) ? (value as string[]) : fallback;

const toScopeConditions = (value: unknown, fallback: FilterCondition[]) =>
  Array.isArray(value) ? (value as FilterCondition[]) : fallback;

export const buildCreateAssessmentInput = (
  workspace: string,
  projectId: string,
  body: Record<string, unknown>,
  timestamp: Date
): AssessmentDbCreate => {
  const { name, description, scope, scope_conditions, fields } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: randomUUID(),
    workspace,
    project_id: projectId,
    name,
    description: typeof description === 'string' ? description : '',
    status: 'draft',
    scope: toScope(scope, []),
    scope_conditions: toScopeConditions(scope_conditions, []),
    fields: toAssessmentFields(fields, []),
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateAssessmentInput = (
  body: Record<string, unknown>,
  existing: AssessmentDbResult,
  updatedAt: Date
): AssessmentDbUpdate => {
  const { name, description, scope, scope_conditions, fields } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    name,
    description: typeof description === 'string' ? description : existing.description,
    status: existing.status,
    scope: toScope(scope, existing.scope),
    scope_conditions: toScopeConditions(scope_conditions, existing.scope_conditions),
    fields: toAssessmentFields(fields, existing.fields),
    updated_at: updatedAt
  };
};

export const toApiAssessment = (
  row: AssessmentDbResult,
  stats: { response_count: number; completed_entity_count: number }
): Assessment => ({
  id: row.id,
  workspace: row.workspace,
  project_id: row.project_id,
  name: row.name,
  description: row.description,
  status: row.status,
  scope: row.scope,
  scope_conditions: row.scope_conditions,
  fields: row.fields,
  response_count: stats.response_count,
  completed_entity_count: stats.completed_entity_count,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString()
});
