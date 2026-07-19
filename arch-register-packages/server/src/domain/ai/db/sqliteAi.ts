import type {
  AiDatabase,
  AiConversationDbCreate,
  AiMessageDbCreate,
  AiConfigInputDbUpsert
} from './aiDatabase';
import { aiMappers } from './aiDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteAiDatabase extends SqliteDatabaseBase implements AiDatabase {
  async getAiConfig(ws: string) {
    return this.get(
      'SELECT * FROM workspace_ai_config WHERE workspace = ?',
      [ws],
      aiMappers.config
    );
  }

  async listAiConfigs() {
    return this.all(
      'SELECT * FROM workspace_ai_config WHERE api_key_enc IS NOT NULL ORDER BY workspace',
      [],
      aiMappers.config
    );
  }

  async upsertAiConfig(ws: string, input: AiConfigInputDbUpsert) {
    const now = new Date().toISOString();
    const existing = await this.getAiConfig(ws);

    if (existing) {
      this.run(
        `UPDATE workspace_ai_config
         SET provider = COALESCE(?, provider),
             api_key_enc = COALESCE(?, api_key_enc),
             base_url = ?,
             model = ?,
             temperature = ?,
             system_prompt = ?,
             enabled = COALESCE(?, enabled),
             updated_at = ?
         WHERE workspace = ?`,
        [
          input.provider ?? null,
          input.api_key_enc ?? null,
          input.base_url !== undefined ? input.base_url : existing.base_url,
          input.model !== undefined ? input.model : existing.model,
          input.temperature !== undefined ? input.temperature : existing.temperature,
          input.system_prompt !== undefined ? input.system_prompt : existing.system_prompt,
          input.enabled != null ? (input.enabled ? 1 : 0) : null,
          now,
          ws
        ]
      );
    } else {
      this.run(
        `INSERT INTO workspace_ai_config (workspace, provider, api_key_enc, base_url, model, temperature, system_prompt, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ws,
          input.provider ?? 'openrouter',
          input.api_key_enc ?? null,
          input.base_url ?? null,
          input.model ?? null,
          input.temperature ?? null,
          input.system_prompt ?? null,
          input.enabled != null ? (input.enabled ? 1 : 0) : 1,
          now,
          now
        ]
      );
    }

    return (await this.getAiConfig(ws))!;
  }

  async listConversations(ws: string, userId: string) {
    return this.all(
      'SELECT * FROM ai_conversation WHERE workspace = ? AND user_id = ? ORDER BY updated_at DESC',
      [ws, userId],
      aiMappers.conversation
    );
  }

  async getConversation(ws: string, id: string) {
    return this.get(
      'SELECT * FROM ai_conversation WHERE id = ? AND workspace = ?',
      [id, ws],
      aiMappers.conversation
    );
  }

  async createConversation(input: AiConversationDbCreate) {
    this.run(
      'INSERT INTO ai_conversation (id, workspace, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.user_id,
        input.title,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getConversation(input.workspace, input.id))!;
  }

  async updateConversationTitle(ws: string, id: string, title: string) {
    this.run(
      'UPDATE ai_conversation SET title = ?, updated_at = ? WHERE id = ? AND workspace = ?',
      [title, new Date().toISOString(), id, ws]
    );
    return this.getConversation(ws, id);
  }

  async initConversationTitle(ws: string, id: string, title: string) {
    this.run(
      "UPDATE ai_conversation SET title = ?, updated_at = ? WHERE id = ? AND workspace = ? AND title = 'New conversation'",
      [title, new Date().toISOString(), id, ws]
    );
  }

  async deleteConversation(ws: string, id: string) {
    const existing = await this.getConversation(ws, id);
    if (!existing) return null;
    this.run('DELETE FROM ai_conversation WHERE id = ? AND workspace = ?', [id, ws]);
    return existing;
  }

  async listMessages(conversationId: string) {
    return this.all(
      'SELECT * FROM ai_message WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId],
      aiMappers.message
    );
  }

  async createMessage(input: AiMessageDbCreate) {
    this.run(
      'INSERT INTO ai_message (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.conversation_id,
        input.role,
        input.content,
        JSON.stringify(input.metadata),
        input.created_at.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM ai_message WHERE id = ?',
      [input.id],
      aiMappers.message
    ))!;
  }
}
