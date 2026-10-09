import { databaseDate } from '../../../db/rowMappers';

export type WorkspaceApplicationDbResult = {
  id: string;
  workspace: string;
  key: string;
  name: string;
  description: string;
  accent_color: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
};

export const mapWorkspaceApplicationRow = (
  row: Record<string, unknown>
): WorkspaceApplicationDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  key: String(row['key']),
  name: String(row['name']),
  description: String(row['description'] ?? ''),
  accent_color: row['accent_color'] == null ? null : String(row['accent_color']),
  sort_order: Number(row['sort_order']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at']),
  updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
});

export type ApplicationDbCreate = {
  id: string;
  workspace: string;
  key: string;
  name: string;
  description?: string;
  accent_color?: string | null;
  sort_order: number;
  updated_by: string | null;
};

export type ApplicationDbUpdate = {
  name?: string;
  description?: string;
  /** Present (including `null`) means "set"; absent means "leave unchanged". */
  accent_color?: string | null;
  sort_order?: number;
  updated_by: string | null;
};

export type ApplicationDatabase = {
  list(workspace: string): Promise<WorkspaceApplicationDbResult[]>;
  get(workspace: string, id: string): Promise<WorkspaceApplicationDbResult | null>;
  getByKey(workspace: string, key: string): Promise<WorkspaceApplicationDbResult | null>;
  create(input: ApplicationDbCreate): Promise<WorkspaceApplicationDbResult>;
  update(
    workspace: string,
    id: string,
    input: ApplicationDbUpdate
  ): Promise<WorkspaceApplicationDbResult | null>;
  remove(workspace: string, id: string): Promise<WorkspaceApplicationDbResult | null>;
};
