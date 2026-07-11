import type {
  DiscussionDatabase,
  DiscussionObjectType,
  DiscussionPostDbCreate,
  DiscussionPostDbResult
} from './discussionDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresDiscussionDatabase extends PostgresDatabaseBase implements DiscussionDatabase {
  async listByObject(ws: string, objectType: DiscussionObjectType, objectId: string) {
    return await this.sql<DiscussionPostDbResult[]>`
      SELECT * FROM discussion_post
      WHERE workspace = ${ws} AND object_type = ${objectType} AND object_id = ${objectId}
      ORDER BY created_at ASC
    `;
  }

  async listAll(ws: string) {
    return await this.sql<DiscussionPostDbResult[]>`
      SELECT * FROM discussion_post
      WHERE workspace = ${ws}
      ORDER BY created_at ASC
    `;
  }

  async getPost(ws: string, id: string) {
    const [row] = await this.sql<DiscussionPostDbResult[]>`
      SELECT * FROM discussion_post
      WHERE workspace = ${ws} AND id = ${id}
    `;
    return row ?? null;
  }

  async createPost(input: DiscussionPostDbCreate) {
    try {
      const [row] = await this.sql<DiscussionPostDbResult[]>`
        INSERT INTO discussion_post (
          id, workspace, object_type, object_id, parent_post_id, author_id, body, created_at, updated_at
        )
        VALUES (
          ${input.id}, ${input.workspace}, ${input.object_type}, ${input.object_id},
          ${input.parent_post_id}, ${input.author_id}, ${input.body}, ${input.created_at}, ${input.updated_at}
        )
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updatePost(ws: string, id: string, body: string, updatedAt: Date, editedAt: Date) {
    try {
      const [row] = await this.sql<DiscussionPostDbResult[]>`
        UPDATE discussion_post
        SET body = ${body}, updated_at = ${updatedAt}, edited_at = ${editedAt}
        WHERE workspace = ${ws} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deletePost(ws: string, id: string) {
    try {
      const [row] = await this.sql<DiscussionPostDbResult[]>`
        DELETE FROM discussion_post
        WHERE workspace = ${ws} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
