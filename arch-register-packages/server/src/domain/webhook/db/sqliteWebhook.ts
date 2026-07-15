import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  WebhookDatabase,
  WorkspaceWebhookDbCreate,
  WorkspaceWebhookDbUpdate
} from './webhookDatabase';
import { webhookMapper } from './webhookDatabase';

export class SqliteWebhookDatabase extends SqliteDatabaseBase implements WebhookDatabase {
  async listWebhooks(workspace: string) {
    return this.all(
      'SELECT * FROM workspace_webhook WHERE workspace = ? ORDER BY created_at, id',
      [workspace],
      webhookMapper
    );
  }

  async getWebhook(workspace: string, id: string) {
    return await this.get(
      'SELECT * FROM workspace_webhook WHERE workspace = ? AND id = ?',
      [workspace, id],
      webhookMapper
    );
  }

  async createWebhook(input: WorkspaceWebhookDbCreate) {
    this.run(
      `INSERT INTO workspace_webhook
       (id, workspace, url, event_filter, hmac_secret, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.url,
        JSON.stringify(input.event_filter),
        input.hmac_secret,
        input.enabled ? 1 : 0,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM workspace_webhook WHERE id = ?',
      [input.id],
      webhookMapper
    ))!;
  }

  async updateWebhook(workspace: string, id: string, input: WorkspaceWebhookDbUpdate) {
    this.run(
      `UPDATE workspace_webhook
       SET url = ?, event_filter = ?, hmac_secret = ?, enabled = ?, updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.url,
        JSON.stringify(input.event_filter),
        input.hmac_secret,
        input.enabled ? 1 : 0,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getWebhook(workspace, id);
  }

  async deleteWebhook(workspace: string, id: string) {
    return (
      this.run('DELETE FROM workspace_webhook WHERE workspace = ? AND id = ?', [workspace, id])
        .changes > 0
    );
  }
}
