import { newid } from '@diagram-craft/utils/id';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  MarkdownRevisionDatabase,
  MarkdownRevisionDbCreate
} from './markdownRevisionDatabase';
import { MARKDOWN_REVISION_SELECT_SQL, markdownRevisionMapper } from './markdownRevisionDatabase';
import { normalizeMarkdownRevisionFields } from './projectDbNormalization';

export class SqliteMarkdownRevisionDatabase
  extends SqliteDatabaseBase
  implements MarkdownRevisionDatabase
{
  async listMarkdownRevisions(workspace: string, nodeId: string) {
    return this.all(
      `${MARKDOWN_REVISION_SELECT_SQL}
       WHERE mr.workspace = ? AND mr.node_id = ?
       ORDER BY mr.revision_number DESC`,
      [workspace, nodeId],
      markdownRevisionMapper
    );
  }

  async getMarkdownRevision(workspace: string, nodeId: string, revisionId: string) {
    return this.get(
      `${MARKDOWN_REVISION_SELECT_SQL}
       WHERE mr.workspace = ? AND mr.node_id = ? AND mr.id = ?`,
      [workspace, nodeId, revisionId],
      markdownRevisionMapper
    );
  }

  async createMarkdownRevision(input: MarkdownRevisionDbCreate) {
    const normalized = normalizeMarkdownRevisionFields(input);
    const id = normalized.id ?? newid();
    this.run(
      `INSERT INTO content_node_revision
         (id, workspace, node_id, revision_number, title, body, created_at, created_by, restored_from_revision_id, document_type_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.workspace,
        input.node_id,
        input.revision_number,
        input.title,
        input.body,
        input.created_at.toISOString(),
        input.created_by,
        normalized.restored_from_revision_id,
        normalized.document_type_id,
        JSON.stringify(normalized.metadata)
      ]
    );
    return (await this.getMarkdownRevision(input.workspace, input.node_id, id))!;
  }

  async getNextMarkdownRevisionNumber(workspace: string, nodeId: string) {
    const row = this.db
      .prepare(
        'SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision_number FROM content_node_revision WHERE workspace = ? AND node_id = ?'
      )
      .get(workspace, nodeId) as { next_revision_number: number };
    return Number(row.next_revision_number);
  }
}
