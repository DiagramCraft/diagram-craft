import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type ExternalContentStatus = 'pending' | 'syncing' | 'succeeded' | 'failed';

export type GitSourceConfig = { type: 'git'; url: string };

export type ExternalContentSourceDbResult = {
  id: string;
  workspace: string;
  source_type: 'git';
  source_config: GitSourceConfig;
  identity_key: string;
  schedule_id: string | null;
  enabled: boolean;
  status: ExternalContentStatus;
  last_attempt_at: Date | null;
  last_synced_at: Date | null;
  last_revision: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ExternalContentSourceDbCreate = Omit<
  ExternalContentSourceDbResult,
  'last_attempt_at' | 'last_synced_at' | 'last_revision' | 'last_error'
> & {
  last_attempt_at?: Date | null;
  last_synced_at?: Date | null;
  last_revision?: string | null;
  last_error?: string | null;
};

export type ExternalContentMountDbResult = {
  id: string;
  workspace: string;
  source_id: string;
  project_id: string | null;
  entity_id: string | null;
  destination_path: string;
  source_path: string;
  status: ExternalContentStatus;
  last_synced_at: Date | null;
  last_revision: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ExternalContentMountDbCreate = ExternalContentMountDbResult;

export const externalContentMappers = {
  source: (row: DatabaseRow): ExternalContentSourceDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    source_type: String(row['source_type']) as 'git',
    source_config: parseDatabaseJson(row['source_config'], { type: 'git', url: '' }, 'external_content_source.source_config'),
    identity_key: String(row['identity_key']),
    schedule_id: row['schedule_id'] == null ? null : String(row['schedule_id']),
    enabled: databaseBoolean(row['enabled']),
    status: String(row['status']) as ExternalContentStatus,
    last_attempt_at: row['last_attempt_at'] == null ? null : databaseDate(row['last_attempt_at']),
    last_synced_at: row['last_synced_at'] == null ? null : databaseDate(row['last_synced_at']),
    last_revision: row['last_revision'] == null ? null : String(row['last_revision']),
    last_error: row['last_error'] == null ? null : String(row['last_error']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  mount: (row: DatabaseRow): ExternalContentMountDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    source_id: String(row['source_id']),
    project_id: row['project_id'] == null ? null : String(row['project_id']),
    entity_id: row['entity_id'] == null ? null : String(row['entity_id']),
    destination_path: String(row['destination_path']),
    source_path: String(row['source_path'] ?? ''),
    status: String(row['status']) as ExternalContentStatus,
    last_synced_at: row['last_synced_at'] == null ? null : databaseDate(row['last_synced_at']),
    last_revision: row['last_revision'] == null ? null : String(row['last_revision']),
    last_error: row['last_error'] == null ? null : String(row['last_error']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  })
};

export type ExternalContentDatabase = {
  createSource(input: ExternalContentSourceDbCreate): Promise<ExternalContentSourceDbResult>;
  getSource(workspace: string, id: string): Promise<ExternalContentSourceDbResult | null>;
  getSourceByIdentity(
    workspace: string,
    sourceType: 'git',
    identityKey: string
  ): Promise<ExternalContentSourceDbResult | null>;
  listSources(workspace: string): Promise<ExternalContentSourceDbResult[]>;
  updateSource(
    id: string,
    input: Partial<Pick<ExternalContentSourceDbResult, 'schedule_id' | 'enabled' | 'status' | 'last_attempt_at' | 'last_synced_at' | 'last_revision' | 'last_error' | 'updated_at'>>
  ): Promise<ExternalContentSourceDbResult | null>;
  deleteSource(workspace: string, id: string): Promise<void>;

  createMount(input: ExternalContentMountDbCreate): Promise<ExternalContentMountDbResult>;
  getMount(workspace: string, id: string): Promise<ExternalContentMountDbResult | null>;
  listMounts(workspace: string): Promise<ExternalContentMountDbResult[]>;
  listMountsBySource(workspace: string, sourceId: string): Promise<ExternalContentMountDbResult[]>;
  updateMount(
    id: string,
    input: Partial<Pick<ExternalContentMountDbResult, 'status' | 'last_synced_at' | 'last_revision' | 'last_error' | 'updated_at'>>
  ): Promise<ExternalContentMountDbResult | null>;
  deleteMount(workspace: string, id: string): Promise<void>;
};
