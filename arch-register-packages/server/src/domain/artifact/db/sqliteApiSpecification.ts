import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type { DatabaseRow } from '../../../db/rowMappers';
import type {
  ApiSpecificationDatabase,
  ApiSpecificationItemDbCreate,
  ApiSpecificationItemFilters,
  ApiSpecificationRevisionDbCreate
} from './apiSpecificationDatabase';
import { apiSpecificationMappers } from './apiSpecificationDatabase';

const iso = (value: Date) => value.toISOString();
const json = (value: unknown) => JSON.stringify(value);

export class SqliteApiSpecificationDatabase
  extends SqliteDatabaseBase
  implements ApiSpecificationDatabase
{
  async getRevision(workspace: string, artifactRevisionId: string) {
    const revision = this.get(
      `SELECT * FROM catalog_api_spec_revision
       WHERE workspace = ? AND artifact_revision_id = ?`,
      [workspace, artifactRevisionId]
    );
    if (!revision) return null;
    const diagnostics = this.all(
      `SELECT * FROM catalog_api_spec_diagnostic
       WHERE workspace = ? AND artifact_revision_id = ? ORDER BY sort_order, id`,
      [workspace, artifactRevisionId],
      apiSpecificationMappers.diagnostic
    );
    return apiSpecificationMappers.revision(revision as DatabaseRow, diagnostics);
  }

  async listItems(
    workspace: string,
    artifactRevisionId: string,
    filters: ApiSpecificationItemFilters,
    pagination: { limit: number; offset: number }
  ) {
    const conditions = ['i.workspace = ?', 'i.artifact_revision_id = ?'];
    const params: unknown[] = [workspace, artifactRevisionId];
    const addParam = (value: unknown) => {
      params.push(value);
      return '?';
    };
    if (filters.kind !== undefined) conditions.push(`i.item_kind = ${addParam(filters.kind)}`);
    if (filters.action !== undefined) conditions.push(`i.action = ${addParam(filters.action)}`);
    if (filters.deprecated !== undefined)
      conditions.push(`i.deprecated = ${addParam(filters.deprecated ? 1 : 0)}`);
    if (filters.tag !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM catalog_api_spec_item_tag tag_filter
          WHERE tag_filter.workspace = i.workspace AND tag_filter.item_id = i.id
            AND tag_filter.tag = ${addParam(filters.tag)})`
      );
    }
    if (filters.resource !== undefined)
      conditions.push(
        `LOWER(COALESCE(i.path, i.channel, '')) LIKE ${addParam(`%${filters.resource.toLowerCase()}%`)}`
      );
    if (filters.q !== undefined) {
      const query = `%${filters.q.toLowerCase()}%`;
      const textParam = addParam(query);
      const tagParam = addParam(query);
      conditions.push(
        `(LOWER(
          COALESCE(i.identifier, '') || ' ' || COALESCE(i.declared_identifier, '') || ' ' ||
          COALESCE(i.summary, '') || ' ' || COALESCE(i.description, '') || ' ' ||
          COALESCE(i.path, '') || ' ' || COALESCE(i.channel, '') || ' ' || i.action
        ) LIKE ${textParam}
          OR EXISTS (SELECT 1 FROM catalog_api_spec_item_tag query_tag
            WHERE query_tag.workspace = i.workspace AND query_tag.item_id = i.id
              AND LOWER(query_tag.tag) LIKE ${tagParam}))`
      );
    }
    const where = conditions.join(' AND ');
    const countRows = this.all<{ count: number | string }>(
      `SELECT COUNT(*) AS count FROM catalog_api_spec_item i WHERE ${where}`,
      params
    );
    const pageParams = [...params, pagination.limit, pagination.offset];
    const rows = this.all<DatabaseRow>(
      `SELECT i.* FROM catalog_api_spec_item i
       WHERE ${where}
       ORDER BY i.sort_order, i.id
       LIMIT ? OFFSET ?`,
      pageParams
    );
    const itemIds = rows.map(row => String(row['id']));
    const tagRows =
      itemIds.length === 0
        ? []
        : this.all<DatabaseRow>(
            `SELECT item_id, tag FROM catalog_api_spec_item_tag
             WHERE workspace = ? AND item_id IN (${itemIds.map(() => '?').join(', ')})
             ORDER BY item_id, tag`,
            [workspace, ...itemIds]
          );
    const tagsByItem = new Map<string, string[]>();
    for (const row of tagRows) {
      const itemId = String(row['item_id']);
      const tags = tagsByItem.get(itemId) ?? [];
      tags.push(String(row['tag']));
      tagsByItem.set(itemId, tags);
    }
    return {
      total: Number(countRows[0]?.count ?? 0),
      items: rows.map(row =>
        apiSpecificationMappers.item(row, tagsByItem.get(String(row['id'])) ?? [])
      )
    };
  }

  async replaceRevision(input: ApiSpecificationRevisionDbCreate) {
    this.run(
      `DELETE FROM catalog_api_spec_item_tag
       WHERE workspace = ? AND item_id IN (
         SELECT id FROM catalog_api_spec_item WHERE workspace = ? AND artifact_revision_id = ?
       )`,
      [input.workspace, input.workspace, input.artifact_revision_id]
    );
    this.run(
      `DELETE FROM catalog_api_spec_item
       WHERE workspace = ? AND artifact_revision_id = ?`,
      [input.workspace, input.artifact_revision_id]
    );
    this.run(
      `DELETE FROM catalog_api_spec_diagnostic
       WHERE workspace = ? AND artifact_revision_id = ?`,
      [input.workspace, input.artifact_revision_id]
    );
    this.run(
      `INSERT INTO catalog_api_spec_revision
       (workspace, artifact_revision_id, protocol, specification_version, title, description,
        status, item_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace, artifact_revision_id) DO UPDATE SET
        protocol = excluded.protocol, specification_version = excluded.specification_version,
        title = excluded.title, description = excluded.description, status = excluded.status,
        item_count = excluded.item_count, updated_at = excluded.updated_at`,
      [
        input.workspace,
        input.artifact_revision_id,
        input.protocol,
        input.specification_version,
        input.title,
        input.description,
        input.status,
        input.item_count,
        iso(input.created_at),
        iso(input.updated_at)
      ]
    );
    for (const item of input.items) this.insertItem(input, item);
    for (const diagnostic of input.diagnostics) {
      this.run(
        `INSERT INTO catalog_api_spec_diagnostic
         (id, workspace, artifact_revision_id, severity, category, code, message,
          source_pointer, source_line, source_column, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          diagnostic.id,
          input.workspace,
          input.artifact_revision_id,
          diagnostic.severity,
          diagnostic.category,
          diagnostic.code,
          diagnostic.message,
          diagnostic.source_pointer,
          diagnostic.source_line,
          diagnostic.source_column,
          diagnostic.sort_order
        ]
      );
    }
  }

  private insertItem(input: ApiSpecificationRevisionDbCreate, item: ApiSpecificationItemDbCreate) {
    this.run(
      `INSERT INTO catalog_api_spec_item
       (id, workspace, artifact_revision_id, item_key, protocol, item_kind, path, channel, action,
        identifier, declared_identifier, summary, description, deprecated, parameters,
        input_summary, output_summary, metadata, source_pointer, source_line, source_column, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        input.workspace,
        input.artifact_revision_id,
        item.item_key,
        item.protocol,
        item.item_kind,
        item.path,
        item.channel,
        item.action,
        item.identifier,
        item.declared_identifier,
        item.summary,
        item.description,
        item.deprecated ? 1 : 0,
        json(item.parameters),
        item.input_summary == null ? null : json(item.input_summary),
        item.output_summary == null ? null : json(item.output_summary),
        json(item.metadata),
        item.source_pointer,
        item.source_line,
        item.source_column,
        item.sort_order
      ]
    );
    for (const tag of item.tags) {
      this.run(`INSERT INTO catalog_api_spec_item_tag (workspace, item_id, tag) VALUES (?, ?, ?)`, [
        input.workspace,
        item.id,
        tag
      ]);
    }
  }
}
