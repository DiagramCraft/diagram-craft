import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';
import type { WebhookEventFilter } from '@arch-register/api-types/webhookContract';

export type WorkspaceWebhookDbResult = {
  id: string;
  workspace: string;
  url: string;
  event_filter: WebhookEventFilter;
  hmac_secret: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type WorkspaceWebhookDbCreate = WorkspaceWebhookDbResult;
export type WorkspaceWebhookDbUpdate = Omit<
  WorkspaceWebhookDbResult,
  'id' | 'workspace' | 'created_at'
>;

export type WebhookDatabase = {
  listWebhooks(workspace: string): Promise<WorkspaceWebhookDbResult[]>;
  getWebhook(workspace: string, id: string): Promise<WorkspaceWebhookDbResult | null>;
  createWebhook(input: WorkspaceWebhookDbCreate): Promise<WorkspaceWebhookDbResult>;
  updateWebhook(
    workspace: string,
    id: string,
    input: WorkspaceWebhookDbUpdate
  ): Promise<WorkspaceWebhookDbResult | null>;
  deleteWebhook(workspace: string, id: string): Promise<boolean>;
};

export const webhookMapper = (row: DatabaseRow): WorkspaceWebhookDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  url: String(row['url']),
  event_filter: parseDatabaseJson(
    row['event_filter'],
    { operations: ['create', 'update', 'delete'], schema_ids: [] },
    'workspace_webhook.event_filter'
  ),
  hmac_secret: String(row['hmac_secret']),
  enabled: databaseBoolean(row['enabled']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});
