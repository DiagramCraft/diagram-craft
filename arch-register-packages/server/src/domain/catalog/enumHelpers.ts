import { newid } from '@diagram-craft/utils/id';
import type {
  WorkspaceEnumDbCreate,
  WorkspaceEnumDbUpdate
} from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';

type EnumOption = WorkspaceEnumDbResult['options'][number];

const toEnumOptions = (value: unknown, fallback: EnumOption[]) =>
  Array.isArray(value) ? (value as EnumOption[]) : fallback;

const toSortOrder = (value: unknown, fallback: number) =>
  typeof value === 'number' ? value : fallback;

export const buildCreateEnumInput = (
  workspace: string,
  body: Record<string, unknown>,
  timestamp: Date
): WorkspaceEnumDbCreate => {
  const { name, options, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: newid(),
    workspace,
    name,
    options: toEnumOptions(options, []),
    sort_order: toSortOrder(sort_order, 0),
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateEnumInput = (
  body: Record<string, unknown>,
  existing: WorkspaceEnumDbResult,
  updatedAt: Date
): WorkspaceEnumDbUpdate => {
  const { name, options, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    name,
    options: toEnumOptions(options, existing.options),
    sort_order: toSortOrder(sort_order, existing.sort_order),
    updated_at: updatedAt
  };
};

export const isEnumReferencedBySchemas = (schemas: SchemaDbResult[], enumId: string) =>
  schemas.some(schema => schema.fields.some(f => f.type === 'select' && f.enumId === enumId));
