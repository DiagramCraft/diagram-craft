import type { WikiCommentDatabase, WikiCommentDbCreate } from './wikiCommentDatabase';
import { wikiCommentMappers } from './wikiCommentDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';

export class PostgresWikiCommentDatabase
  extends PostgresDatabaseBase
  implements WikiCommentDatabase
{
  async listByNode(ws: string, nodeId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM wiki_inline_comment
      WHERE workspace = ${ws} AND node_id = ${nodeId}
      ORDER BY created_at ASC
    `;
    return mapDatabaseRows(rows, wikiCommentMappers.post);
  }

  async getPost(ws: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM wiki_inline_comment
      WHERE workspace = ${ws} AND id = ${id}
    `;
    return row ? wikiCommentMappers.post(row) : null;
  }

  async createPost(input: WikiCommentDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO wiki_inline_comment (
          id, workspace, node_id, parent_post_id, author_id, body,
          quote, prefix, suffix, anchor_start, anchor_end, created_at, updated_at
        )
        VALUES (
          ${input.id}, ${input.workspace}, ${input.node_id}, ${input.parent_post_id},
          ${input.author_id}, ${input.body}, ${input.quote}, ${input.prefix}, ${input.suffix},
          ${input.anchor_start}, ${input.anchor_end}, ${input.created_at}, ${input.updated_at}
        )
        RETURNING *
      `;
      return wikiCommentMappers.post(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updatePost(ws: string, id: string, body: string, updatedAt: Date, editedAt: Date) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE wiki_inline_comment
        SET body = ${body}, updated_at = ${updatedAt}, edited_at = ${editedAt}
        WHERE workspace = ${ws} AND id = ${id}
        RETURNING *
      `;
      return row ? wikiCommentMappers.post(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async setResolved(
    ws: string,
    id: string,
    resolvedAt: Date | null,
    resolvedBy: string | null,
    updatedAt: Date
  ) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE wiki_inline_comment
        SET resolved_at = ${resolvedAt}, resolved_by = ${resolvedBy}, updated_at = ${updatedAt}
        WHERE workspace = ${ws} AND id = ${id}
        RETURNING *
      `;
      return row ? wikiCommentMappers.post(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deletePost(ws: string, id: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM wiki_inline_comment
        WHERE workspace = ${ws} AND id = ${id}
        RETURNING *
      `;
      return row ? wikiCommentMappers.post(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
