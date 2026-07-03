import { randomUUID } from 'node:crypto';
import type { AssessmentDbCreate, AssessmentDbResult, AssessmentDbUpdate } from './db/projectDatabase';
import { httpAssert } from '../../utils/httpAssert';
import { Assessment, AssessmentField } from '@arch-register/api-types/assessmentContract';

const toAssessmentFields = (value: unknown, fallback: AssessmentField[]) =>
  Array.isArray(value) ? (value as AssessmentField[]) : fallback;

const toScope = (value: unknown, fallback: string[]) =>
  Array.isArray(value) ? (value as string[]) : fallback;

export const buildCreateAssessmentInput = (
  workspace: string,
  projectId: string,
  body: Record<string, unknown>,
  timestamp: Date
): AssessmentDbCreate => {
  const { name, description, scope, fields } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: randomUUID(),
    workspace,
    project_id: projectId,
    name,
    description: typeof description === 'string' ? description : '',
    status: 'active',
    scope: toScope(scope, []),
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
  const { name, description, scope, fields } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    name,
    description: typeof description === 'string' ? description : existing.description,
    status: existing.status,
    scope: toScope(scope, existing.scope),
    fields: toAssessmentFields(fields, existing.fields),
    updated_at: updatedAt
  };
};

export const toApiAssessment = (row: AssessmentDbResult): Assessment => ({
  id: row.id,
  workspace: row.workspace,
  project_id: row.project_id,
  name: row.name,
  description: row.description,
  status: row.status,
  scope: row.scope,
  fields: row.fields,
  // Response recording isn't implemented yet (tracked separately); always 0 until it lands.
  response_count: 0,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString()
});
