import { randomUUID } from 'node:crypto';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { isUuidLike } from '../../../utils/publicIds';
import type {
  MarkdownRevisionDatabase,
  MarkdownRevisionDbCreate,
  MarkdownRevisionDbResult
} from './markdownRevisionDatabase';
import { MARKDOWN_REVISION_SELECT_SQL, markdownRevisionMapper } from './markdownRevisionDatabase';
import { normalizeMarkdownRevisionFields } from './projectDbNormalization';

export class PostgresMarkdownRevisionDatabase
  extends PostgresDatabaseBase
  implements MarkdownRevisionDatabase
{
  async listMarkdownRevisions(workspace: string, nodeId: string) {
    if (!isUuidLike(nodeId)) return [];
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${MARKDOWN_REVISION_SELECT_SQL}
       WHERE mr.workspace = $1 AND mr.node_id = $2
       ORDER BY mr.revision_number DESC`,
      [workspace, nodeId]
    );
    return mapDatabaseRows(rows, markdownRevisionMapper);
  }

  async getMarkdownRevision(workspace: string, nodeId: string, revisionId: string) {
    if (!isUuidLike(nodeId) || !isUuidLike(revisionId)) return null;
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${MARKDOWN_REVISION_SELECT_SQL}
       WHERE mr.workspace = $1 AND mr.node_id = $2 AND mr.id = $3`,
      [workspace, nodeId, revisionId]
    );
    return row ? markdownRevisionMapper(row) : null;
  }

  async createMarkdownRevision(input: MarkdownRevisionDbCreate) {
    try {
      const normalized = normalizeMarkdownRevisionFields(input);
      const id = normalized.id ?? randomUUID();
      const [row] = await this.sql<MarkdownRevisionDbResult[]>`
        INSERT INTO content_node_revision
          (id, workspace, node_id, revision_number, title, body, created_at, created_by, restored_from_revision_id, document_type_id, metadata)
        VALUES
          (${id}, ${normalized.workspace}, ${normalized.node_id}, ${normalized.revision_number}, ${normalized.title}, ${normalized.body}, ${normalized.created_at}, ${normalized.created_by}, ${normalized.restored_from_revision_id}, ${normalized.document_type_id}, ${this.json(normalized.metadata)})
        RETURNING *
      `;
      if (!row) {
        throw new Error('Failed to create markdown revision');
      }
      return (await this.getMarkdownRevision(input.workspace, input.node_id, row.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getNextMarkdownRevisionNumber(workspace: string, nodeId: string) {
    const [row] = await this.sql<{ next_revision_number: number }[]>`
      SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision_number
      FROM content_node_revision
      WHERE workspace = ${workspace} AND node_id = ${nodeId}
    `;
    return Number(row?.next_revision_number ?? 1);
  }
}
