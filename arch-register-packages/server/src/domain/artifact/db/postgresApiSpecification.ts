import type { DatabaseRow } from '../../../db/rowMappers';
import type postgres from 'postgres';
import { PostgresDatabaseBase } from '../../../db/postgresBase';
import type { PostgresSqlClient } from '../../../db/postgresBase';
import type {
  ApiSpecificationDatabase,
  ApiSpecificationItemDbCreate,
  ApiSpecificationItemFilters,
  ApiSpecificationRevisionDbCreate
} from './apiSpecificationDatabase';
import { apiSpecificationMappers } from './apiSpecificationDatabase';

type PostgresTransaction = postgres.TransactionSql;

export class PostgresApiSpecificationDatabase
  extends PostgresDatabaseBase
  implements ApiSpecificationDatabase
{
  async getRevision(workspace: string, artifactRevisionId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM catalog_api_spec_revision
      WHERE workspace = ${workspace} AND artifact_revision_id = ${artifactRevisionId}`;
    const revision = rows[0];
    if (!revision) return null;
    const diagnostics = await this.sql<DatabaseRow[]>`
      SELECT * FROM catalog_api_spec_diagnostic
      WHERE workspace = ${workspace} AND artifact_revision_id = ${artifactRevisionId}
      ORDER BY sort_order, id`;
    return apiSpecificationMappers.revision(
      revision,
      diagnostics.map(apiSpecificationMappers.diagnostic)
    );
  }

  async listItems(
    workspace: string,
    artifactRevisionId: string,
    filters: ApiSpecificationItemFilters,
    pagination: { limit: number; offset: number }
  ) {
    const conditions = ['i.workspace = $1', 'i.artifact_revision_id = $2'];
    const params: unknown[] = [workspace, artifactRevisionId];
    const addParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (filters.kind !== undefined) conditions.push(`i.item_kind = ${addParam(filters.kind)}`);
    if (filters.action !== undefined) conditions.push(`i.action = ${addParam(filters.action)}`);
    if (filters.deprecated !== undefined)
      conditions.push(`i.deprecated = ${addParam(filters.deprecated)}`);
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
      const queryParam = addParam(query);
      conditions.push(
        `(LOWER(CONCAT_WS(' ', i.identifier, i.declared_identifier, i.summary, i.description,
          i.path, i.channel, i.action)) LIKE ${queryParam}
          OR EXISTS (SELECT 1 FROM catalog_api_spec_item_tag query_tag
            WHERE query_tag.workspace = i.workspace AND query_tag.item_id = i.id
              AND LOWER(query_tag.tag) LIKE ${queryParam}))`
      );
    }
    const where = conditions.join(' AND ');
    const countRows = await this.sql.unsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM catalog_api_spec_item i WHERE ${where}`,
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    const pageParams = [...params, pagination.limit, pagination.offset];
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `SELECT i.* FROM catalog_api_spec_item i
       WHERE ${where}
       ORDER BY i.sort_order, i.id
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams as Parameters<typeof this.sql.unsafe>[1]
    );
    const itemIds = rows.map(row => String(row['id']));
    const tagRows =
      itemIds.length === 0
        ? []
        : await this.sql<DatabaseRow[]>`
            SELECT item_id, tag FROM catalog_api_spec_item_tag
            WHERE workspace = ${workspace} AND item_id = ANY(${itemIds})
            ORDER BY item_id, tag`;
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
    const transaction = this.sql;
    await transaction`
        DELETE FROM catalog_api_spec_item_tag
        WHERE workspace = ${input.workspace} AND item_id IN (
          SELECT id FROM catalog_api_spec_item
          WHERE workspace = ${input.workspace} AND artifact_revision_id = ${input.artifact_revision_id}
        )`;
    await transaction`
        DELETE FROM catalog_api_spec_item
        WHERE workspace = ${input.workspace} AND artifact_revision_id = ${input.artifact_revision_id}`;
    await transaction`
        DELETE FROM catalog_api_spec_diagnostic
        WHERE workspace = ${input.workspace} AND artifact_revision_id = ${input.artifact_revision_id}`;
    await transaction`
        INSERT INTO catalog_api_spec_revision
        (workspace, artifact_revision_id, protocol, specification_version, title, description,
         status, item_count, created_at, updated_at)
        VALUES (${input.workspace}, ${input.artifact_revision_id}, ${input.protocol},
          ${input.specification_version}, ${input.title}, ${input.description}, ${input.status},
          ${input.item_count}, ${input.created_at}, ${input.updated_at})
        ON CONFLICT (workspace, artifact_revision_id) DO UPDATE SET
          protocol = EXCLUDED.protocol, specification_version = EXCLUDED.specification_version,
          title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
          item_count = EXCLUDED.item_count, updated_at = EXCLUDED.updated_at`;
    for (const item of input.items) await this.insertItem(transaction, input, item);
    for (const diagnostic of input.diagnostics) {
      await transaction`
          INSERT INTO catalog_api_spec_diagnostic
          (id, workspace, artifact_revision_id, severity, category, code, message,
           source_pointer, source_line, source_column, sort_order)
          VALUES (${diagnostic.id}, ${input.workspace}, ${input.artifact_revision_id},
            ${diagnostic.severity}, ${diagnostic.category}, ${diagnostic.code}, ${diagnostic.message},
            ${diagnostic.source_pointer}, ${diagnostic.source_line}, ${diagnostic.source_column},
            ${diagnostic.sort_order})`;
    }
  }

  private async insertItem(
    transaction: PostgresSqlClient | PostgresTransaction,
    input: ApiSpecificationRevisionDbCreate,
    item: ApiSpecificationItemDbCreate
  ) {
    await transaction`
      INSERT INTO catalog_api_spec_item
      (id, workspace, artifact_revision_id, item_key, protocol, item_kind, path, channel, action,
       identifier, declared_identifier, summary, description, deprecated, parameters,
       input_summary, output_summary, metadata, source_pointer, source_line, source_column, sort_order)
      VALUES (${item.id}, ${input.workspace}, ${input.artifact_revision_id}, ${item.item_key},
        ${item.protocol}, ${item.item_kind}, ${item.path}, ${item.channel}, ${item.action},
        ${item.identifier}, ${item.declared_identifier}, ${item.summary}, ${item.description},
        ${item.deprecated}, ${this.json(item.parameters)},
        ${item.input_summary == null ? null : this.json(item.input_summary)},
        ${item.output_summary == null ? null : this.json(item.output_summary)}, ${this.json(item.metadata)},
        ${item.source_pointer}, ${item.source_line}, ${item.source_column}, ${item.sort_order})`;
    for (const tag of item.tags) {
      await transaction`
        INSERT INTO catalog_api_spec_item_tag (workspace, item_id, tag)
        VALUES (${input.workspace}, ${item.id}, ${tag})`;
    }
  }
}
