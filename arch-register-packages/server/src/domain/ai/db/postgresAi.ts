import type {
  AiConversation,
  AiDatabase,
  AiMessage,
  CreateConversationInput,
  CreateMessageInput,
  UpsertAiConfigInput,
  WorkspaceAiConfig
} from './aiDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

type AiConfigRow = WorkspaceAiConfig;
type ConversationRow = AiConversation;
type MessageRow = AiMessage;

export class PostgresAiDatabase extends PostgresDatabaseBase implements AiDatabase {
  async getAiConfig(ws: string) {
    const [row] = await this.sql<AiConfigRow[]>`
      SELECT * FROM workspace_ai_config WHERE workspace = ${ws}
    `;
    return row ?? null;
  }

  async upsertAiConfig(ws: string, input: UpsertAiConfigInput) {
    try {
      const now = new Date();
      const existing = await this.getAiConfig(ws);

      if (existing) {
        const [row] = await this.sql<AiConfigRow[]>`
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
        return row!;
      }

      const [row] = await this.sql<AiConfigRow[]>`
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
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listConversations(ws: string, userId: string) {
    return await this.sql<ConversationRow[]>`
      SELECT * FROM ai_conversation
      WHERE workspace = ${ws} AND user_id = ${userId}
      ORDER BY updated_at DESC
    `;
  }

  async getConversation(ws: string, id: string) {
    const [row] = await this.sql<ConversationRow[]>`
      SELECT * FROM ai_conversation WHERE id = ${id} AND workspace = ${ws}
    `;
    return row ?? null;
  }

  async createConversation(input: CreateConversationInput) {
    try {
      const [row] = await this.sql<ConversationRow[]>`
        INSERT INTO ai_conversation (id, workspace, user_id, title, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.user_id}, ${input.title}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateConversationTitle(ws: string, id: string, title: string) {
    const [row] = await this.sql<ConversationRow[]>`
      UPDATE ai_conversation SET title = ${title}, updated_at = ${new Date()}
      WHERE id = ${id} AND workspace = ${ws}
      RETURNING *
    `;
    return row ?? null;
  }

  async initConversationTitle(ws: string, id: string, title: string) {
    await this.sql`
      UPDATE ai_conversation SET title = ${title}, updated_at = ${new Date()}
      WHERE id = ${id} AND workspace = ${ws} AND title = 'New conversation'
    `;
  }

  async deleteConversation(ws: string, id: string) {
    const [row] = await this.sql<ConversationRow[]>`
      DELETE FROM ai_conversation WHERE id = ${id} AND workspace = ${ws}
      RETURNING *
    `;
    return row ?? null;
  }

  async listMessages(conversationId: string) {
    return await this.sql<MessageRow[]>`
      SELECT * FROM ai_message
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;
  }

  async createMessage(input: CreateMessageInput) {
    try {
      const [row] = await this.sql<MessageRow[]>`
        INSERT INTO ai_message (id, conversation_id, role, content, metadata, created_at)
        VALUES (${input.id}, ${input.conversation_id}, ${input.role}, ${input.content}, ${this.json(input.metadata)}, ${input.created_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
