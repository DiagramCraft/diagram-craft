import type { WikiCommentDatabase, WikiCommentDbCreate } from './wikiCommentDatabase';
import { wikiCommentMappers } from './wikiCommentDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteWikiCommentDatabase extends SqliteDatabaseBase implements WikiCommentDatabase {
  async listByNode(ws: string, nodeId: string) {
    return this.all(
      'SELECT * FROM wiki_inline_comment WHERE workspace = ? AND node_id = ? ORDER BY created_at ASC',
      [ws, nodeId],
      wikiCommentMappers.post
    );
  }

  async getPost(ws: string, id: string) {
    return this.get(
      'SELECT * FROM wiki_inline_comment WHERE workspace = ? AND id = ?',
      [ws, id],
      wikiCommentMappers.post
    );
  }

  async createPost(input: WikiCommentDbCreate) {
    this.run(
      `INSERT INTO wiki_inline_comment (
        id, workspace, node_id, parent_post_id, author_id, body,
        quote, prefix, suffix, anchor_start, anchor_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.node_id,
        input.parent_post_id,
        input.author_id,
        input.body,
        input.quote,
        input.prefix,
        input.suffix,
        input.anchor_start,
        input.anchor_end,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getPost(input.workspace, input.id))!;
  }

  async updatePost(ws: string, id: string, body: string, updatedAt: Date, editedAt: Date) {
    const existing = await this.getPost(ws, id);
    if (!existing) return null;
    this.run(
      'UPDATE wiki_inline_comment SET body = ?, updated_at = ?, edited_at = ? WHERE workspace = ? AND id = ?',
      [body, updatedAt.toISOString(), editedAt.toISOString(), ws, id]
    );
    return await this.getPost(ws, id);
  }

  async setResolved(
    ws: string,
    id: string,
    resolvedAt: Date | null,
    resolvedBy: string | null,
    updatedAt: Date
  ) {
    const existing = await this.getPost(ws, id);
    if (!existing) return null;
    this.run(
      'UPDATE wiki_inline_comment SET resolved_at = ?, resolved_by = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [resolvedAt ? resolvedAt.toISOString() : null, resolvedBy, updatedAt.toISOString(), ws, id]
    );
    return await this.getPost(ws, id);
  }

  async deletePost(ws: string, id: string) {
    const existing = await this.getPost(ws, id);
    if (!existing) return null;
    this.run('DELETE FROM wiki_inline_comment WHERE workspace = ? AND id = ?', [ws, id]);
    return existing;
  }
}
