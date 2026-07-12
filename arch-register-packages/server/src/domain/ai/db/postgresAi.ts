import type {
  AiDatabase,
  AiConversationDbCreate,
  AiMessageDbCreate,
  AiConfigInputDbUpsert,
} from './aiDatabase';
import { aiMappers } from './aiDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';

export class PostgresAiDatabase extends PostgresDatabaseBase implements AiDatabase {
  async getAiConfig(ws: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_ai_config WHERE workspace = ${ws}
    `;
    return row ? aiMappers.config(row) : null;
  }

  async upsertAiConfig(ws: string, input: AiConfigInputDbUpsert) {
    try {
      const now = new Date();
      const existing = await this.getAiConfig(ws);

      if (existing) {
        const [row] = await this.sql<DatabaseRow[]>`
          UPDATE workspace_ai_config
          SET provider = COALESCE(${input.provider ?? null}, provider),
              api_key_enc = COALESCE(${input.api_key_enc ?? null}, api_key_enc),
              base_url = ${input.base_url !== undefined ? input.base_url : existing.base_url},
              model = ${input.model !== undefined ? input.model : existing.model},
              temperature = ${input.temperature !== undefined ? input.temperature : existing.temperature},
              system_prompt = ${input.system_prompt !== undefined ? input.system_prompt : existing.system_prompt},
              enabled = COALESCE(${input.enabled ?? null}, enabled),
              updated_at = ${now}
          WHERE workspace = ${ws}
          RETURNING *
        `;
        return aiMappers.config(row!);
      }

      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO workspace_ai_config (workspace, provider, api_key_enc, base_url, model, temperature, system_prompt, enabled, created_at, updated_at)
        VALUES (
          ${ws},
          ${input.provider ?? 'openrouter'},
          ${input.api_key_enc ?? null},
          ${input.base_url ?? null},
          ${input.model ?? null},
          ${input.temperature ?? null},
          ${input.system_prompt ?? null},
          ${input.enabled ?? true},
          ${now},
          ${now}
        )
        RETURNING *
      `;
      return aiMappers.config(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listConversations(ws: string, userId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM ai_conversation
      WHERE workspace = ${ws} AND user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return mapDatabaseRows(rows, aiMappers.conversation);
  }

  async getConversation(ws: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM ai_conversation WHERE id = ${id} AND workspace = ${ws}
    `;
    return row ? aiMappers.conversation(row) : null;
  }

  async createConversation(input: AiConversationDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO ai_conversation (id, workspace, user_id, title, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.user_id}, ${input.title}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return aiMappers.conversation(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateConversationTitle(ws: string, id: string, title: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE ai_conversation SET title = ${title}, updated_at = ${new Date()}
      WHERE id = ${id} AND workspace = ${ws}
      RETURNING *
    `;
    return row ? aiMappers.conversation(row) : null;
  }

  async initConversationTitle(ws: string, id: string, title: string) {
    await this.sql`
      UPDATE ai_conversation SET title = ${title}, updated_at = ${new Date()}
      WHERE id = ${id} AND workspace = ${ws} AND title = 'New conversation'
    `;
  }

  async deleteConversation(ws: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      DELETE FROM ai_conversation WHERE id = ${id} AND workspace = ${ws}
      RETURNING *
    `;
    return row ? aiMappers.conversation(row) : null;
  }

  async listMessages(conversationId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM ai_message
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;
    return mapDatabaseRows(rows, aiMappers.message);
  }

  async createMessage(input: AiMessageDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO ai_message (id, conversation_id, role, content, metadata, created_at)
        VALUES (${input.id}, ${input.conversation_id}, ${input.role}, ${input.content}, ${this.json(input.metadata)}, ${input.created_at})
        RETURNING *
      `;
      return aiMappers.message(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
