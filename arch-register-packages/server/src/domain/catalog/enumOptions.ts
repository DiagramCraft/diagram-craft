export type WorkspaceEnumOption = {
  value: string;
  label: string;
  description?: string | null;
  retired?: boolean;
  restricted?: boolean;
};

export type NormalizedWorkspaceEnumOption = {
  value: string;
  label: string;
  description: string | null;
  retired: boolean;
  restricted: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeWorkspaceEnumOption = (value: unknown): NormalizedWorkspaceEnumOption => {
  const option = isRecord(value) ? value : {};
  return {
    value: typeof option.value === 'string' ? option.value : '',
    label: typeof option.label === 'string' ? option.label : '',
    description:
      typeof option.description === 'string' || option.description === null
        ? option.description
        : null,
    retired: option.retired === true,
    restricted: option.restricted === true
  };
};

export const normalizeWorkspaceEnumOptions = (value: unknown): NormalizedWorkspaceEnumOption[] =>
  Array.isArray(value) ? value.map(normalizeWorkspaceEnumOption) : [];

export const getWorkspaceEnumDefinitions = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<WorkspaceEnumDbResult[] | undefined> => {
  const lookup = (db.catalog as { listEnums?: (workspace: string) => Promise<unknown> }).listEnums;
  if (lookup == null) return undefined;
  return (await lookup.call(db.catalog, workspace)) as WorkspaceEnumDbResult[];
};
import type { DatabaseAdapter } from '../../db/database';
import type { WorkspaceEnumDbResult } from './db/catalogDatabase';
