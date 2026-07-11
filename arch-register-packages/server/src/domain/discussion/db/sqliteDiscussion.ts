import type {
  DiscussionDatabase,
  DiscussionObjectType,
  DiscussionPostDbCreate
} from './discussionDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';

export class SqliteDiscussionDatabase extends SqliteDatabaseBase implements DiscussionDatabase {
  async listByObject(ws: string, objectType: DiscussionObjectType, objectId: string) {
    return this.all(
      'SELECT * FROM discussion_post WHERE workspace = ? AND object_type = ? AND object_id = ? ORDER BY created_at ASC',
      [ws, objectType, objectId],
      sqliteMappers.discussionPost
    );
  }

  async listAll(ws: string) {
    return this.all(
      'SELECT * FROM discussion_post WHERE workspace = ? ORDER BY created_at ASC',
      [ws],
      sqliteMappers.discussionPost
    );
  }

  async getPost(ws: string, id: string) {
    return this.get(
      'SELECT * FROM discussion_post WHERE workspace = ? AND id = ?',
      [ws, id],
      sqliteMappers.discussionPost
    );
  }

  async createPost(input: DiscussionPostDbCreate) {
    this.run(
      `INSERT INTO discussion_post (
        id, workspace, object_type, object_id, parent_post_id, author_id, body, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.object_type,
        input.object_id,
        input.parent_post_id,
        input.author_id,
        input.body,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getPost(input.workspace, input.id))!;
  }

  async updatePost(ws: string, id: string, body: string, updatedAt: Date, editedAt: Date) {
    const existing = await this.getPost(ws, id);
    if (!existing) return null;
    this.run('UPDATE discussion_post SET body = ?, updated_at = ?, edited_at = ? WHERE workspace = ? AND id = ?', [
      body,
      updatedAt.toISOString(),
      editedAt.toISOString(),
      ws,
      id
    ]);
    return await this.getPost(ws, id);
  }

  async deletePost(ws: string, id: string) {
    const existing = await this.getPost(ws, id);
    if (!existing) return null;
    this.run('DELETE FROM discussion_post WHERE workspace = ? AND id = ?', [ws, id]);
    return existing;
  }
}
