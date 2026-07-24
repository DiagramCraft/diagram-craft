import type { PostgresSqlClient } from '../../../db/postgresBase';
import type {
  WebhookDatabase,
  WorkspaceWebhookDbCreate,
  WorkspaceWebhookDbUpdate
} from './webhookDatabase';
import { webhookMapper } from './webhookDatabase';
import type { DatabaseRow } from '../../../db/rowMappers';

export class PostgresWebhookDatabase implements WebhookDatabase {
  constructor(private readonly sql: PostgresSqlClient) {}

  async listWebhooks(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_webhook WHERE workspace = ${workspace} ORDER BY created_at, id
    `;
    return rows.map(webhookMapper);
  }

  async getWebhook(workspace: string, id: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_webhook WHERE workspace = ${workspace} AND id = ${id}
    `;
    return rows[0] ? webhookMapper(rows[0]) : null;
  }

  async createWebhook(input: WorkspaceWebhookDbCreate) {
    const rows = await this.sql<DatabaseRow[]>`
      INSERT INTO workspace_webhook
        (id, workspace, url, event_filter, hmac_secret, enabled, created_at, updated_at)
      VALUES (
        ${input.id}, ${input.workspace}, ${input.url}, ${this.sql.json(input.event_filter)},
        ${input.hmac_secret}, ${input.enabled}, ${input.created_at}, ${input.updated_at}
      )
      RETURNING *
    `;
    return webhookMapper(rows[0]!);
  }

  async updateWebhook(workspace: string, id: string, input: WorkspaceWebhookDbUpdate) {
    const rows = await this.sql<DatabaseRow[]>`
      UPDATE workspace_webhook
      SET url = ${input.url}, event_filter = ${this.sql.json(input.event_filter)},
          hmac_secret = ${input.hmac_secret}, enabled = ${input.enabled},
          updated_at = ${input.updated_at}
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING *
    `;
    return rows[0] ? webhookMapper(rows[0]) : null;
  }

  async deleteWebhook(workspace: string, id: string) {
    const rows = await this.sql<{ id: string }[]>`
      DELETE FROM workspace_webhook WHERE workspace = ${workspace} AND id = ${id} RETURNING id
    `;
    return rows.length > 0;
  }
}
