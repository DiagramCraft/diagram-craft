import { randomUUID } from 'node:crypto';
import type {
  ProjectMilestoneDbCreate,
  ProjectMilestoneDbResult,
  ProjectMilestoneDbUpdate
} from './db/projectDatabase';
import { httpAssert } from '../../utils/httpAssert';
import { Milestone } from '@arch-register/api-types/milestoneContract';

export const buildCreateMilestoneInput = (
  workspace: string,
  projectId: string,
  body: Record<string, unknown>,
  timestamp: Date
): ProjectMilestoneDbCreate => {
  const { name, target_date, status, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  httpAssert.string(target_date, { message: 'target_date is required and must be a string' });

  return {
    id: randomUUID(),
    workspace,
    project_id: projectId,
    name,
    target_date,
    status: typeof status === 'string' ? (status as ProjectMilestoneDbResult['status']) : 'planned',
    sort_order: typeof sort_order === 'number' ? sort_order : 0,
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateMilestoneInput = (
  body: Record<string, unknown>,
  existing: ProjectMilestoneDbResult,
  updatedAt: Date
): ProjectMilestoneDbUpdate => {
  const { name, target_date, status, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  httpAssert.string(target_date, { message: 'target_date is required and must be a string' });

  return {
    name,
    target_date,
    status:
      typeof status === 'string' ? (status as ProjectMilestoneDbResult['status']) : existing.status,
    sort_order: typeof sort_order === 'number' ? sort_order : existing.sort_order,
    updated_at: updatedAt
  };
};

export const toApiMilestone = (row: ProjectMilestoneDbResult): Milestone => ({
  id: row.id,
  workspace: row.workspace,
  project_id: row.project_id,
  name: row.name,
  target_date: row.target_date,
  status: row.status,
  sort_order: row.sort_order,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString()
});
