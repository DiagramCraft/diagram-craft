import { randomUUID } from 'node:crypto';
import type { WorkspaceEnumDbCreate, WorkspaceEnumDbUpdate } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';
import { normalizeWorkspaceEnumOptions, type NormalizedWorkspaceEnumOption } from './enumOptions';
import type { RelationSchemaDbResult } from './db/relationDatabase';

type EnumOption = WorkspaceEnumDbResult['options'][number];

const validateRestricted = (value: unknown, index: number) => {
  if (value === undefined) return false;
  httpAssert.boolean(value, {
    status: 400,
    message: `Option ${index + 1} restricted must be a boolean`
  });
  return value as boolean;
};

const normalizeInputOptions = (value: unknown, fallback: EnumOption[]) => {
  if (!Array.isArray(value)) return normalizeWorkspaceEnumOptions(fallback);

  const normalized: NormalizedWorkspaceEnumOption[] = [];
  const values = new Set<string>();
  for (const [index, rawOption] of value.entries()) {
    httpAssert.true(rawOption !== null && typeof rawOption === 'object', {
      status: 400,
      message: `Option ${index + 1} must be an object`
    });
    const option = rawOption as Record<string, unknown>;
    httpAssert.string(option.value, {
      status: 400,
      message: `Option ${index + 1} value is required`
    });
    httpAssert.string(option.label, {
      status: 400,
      message: `Option ${index + 1} label is required`
    });
    if (option.description !== undefined && option.description !== null) {
      httpAssert.string(option.description, {
        status: 400,
        message: `Option ${index + 1} description must be a string`
      });
    }
    if (option.retired !== undefined) {
      httpAssert.boolean(option.retired, {
        status: 400,
        message: `Option ${index + 1} retired must be a boolean`
      });
    }
    const restricted = validateRestricted(option.restricted, index);
    httpAssert.true(!values.has(option.value), {
      status: 400,
      message: `Option value '${option.value}' is duplicated`
    });
    values.add(option.value);
    normalized.push({
      value: option.value,
      label: option.label,
      description: option.description === undefined ? null : (option.description as string | null),
      retired: option.retired === true,
      restricted
    });
  }
  return normalized;
};

const toEnumOptions = (value: unknown, fallback: EnumOption[]) =>
  normalizeInputOptions(value, fallback);

const mergeUpdatedOptions = (
  requested: NormalizedWorkspaceEnumOption[],
  existing: EnumOption[],
  usedOptionValues?: ReadonlySet<string>
) => {
  const existingOptions = normalizeWorkspaceEnumOptions(existing);
  const requestedValues = new Set(requested.map(option => option.value));

  return [
    ...requested,
    ...existingOptions
      .filter(option => !requestedValues.has(option.value))
      .flatMap(option =>
        usedOptionValues === undefined || usedOptionValues.has(option.value)
          ? [{ ...option, retired: true }]
          : []
      )
  ];
};

const toSortOrder = (value: unknown, fallback: number) =>
  typeof value === 'number' ? value : fallback;

const toCategory = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

export const buildCreateEnumInput = (
  workspace: string,
  body: Record<string, unknown>,
  timestamp: Date
): WorkspaceEnumDbCreate => {
  const { name, category, options, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: randomUUID(),
    workspace,
    name,
    category: toCategory(category),
    options: toEnumOptions(options, []),
    sort_order: toSortOrder(sort_order, 0),
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateEnumInput = (
  body: Record<string, unknown>,
  existing: WorkspaceEnumDbResult,
  updatedAt: Date,
  usedOptionValues?: ReadonlySet<string>
): WorkspaceEnumDbUpdate => {
  const { name, category, options, sort_order } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  const requestedOptions = toEnumOptions(options, existing.options);
  return {
    name,
    category: category === undefined ? existing.category : toCategory(category),
    options: mergeUpdatedOptions(requestedOptions, existing.options, usedOptionValues),
    sort_order: toSortOrder(sort_order, existing.sort_order),
    updated_at: updatedAt
  };
};

export const isEnumReferencedBySchemas = (
  schemas: SchemaDbResult[],
  enumId: string,
  relationSchemas: RelationSchemaDbResult[] = []
) =>
  schemas.some(schema => schema.fields.some(f => f.type === 'select' && f.enumId === enumId)) ||
  relationSchemas.some(schema =>
    schema.fields.some(field => field.type === 'select' && field.enumId === enumId)
  );
