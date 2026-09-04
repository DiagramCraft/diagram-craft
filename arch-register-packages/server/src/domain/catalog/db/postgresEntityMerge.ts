import type { MergeRelationConflict } from '@arch-register/api-types/entityMergeContract';
import type { RelationDbResult } from './relationDatabase';
import { PostgresDatabaseBase } from '../../../db/postgresBase';
import {
  buildMergeSideTableAutoDedupeRowIds,
  buildMergeSideTableConflicts,
  mergeRowId,
  mergeRowDedupeKey,
  type EntityMergeDatabase,
  type EntityMergeSideTableSnapshot,
  type MergeRelationResolution,
  type MergeSideTableRow,
  type MergeTrackedTable
} from './entityMergeDatabase';

type SqlRow = Record<string, unknown>;

const text = (value: unknown): string => String(value);
const parameter = (value: unknown): string | number | null =>
  value == null ? null : String(value);

const parseRowId = (rowId: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(rowId);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid entity merge side-table row identity');
  }
  return parsed as Record<string, unknown>;
};

export class PostgresEntityMergeDatabase
  extends PostgresDatabaseBase
  implements EntityMergeDatabase
{
  async getSideTableSnapshot(
    workspace: string,
    sourceId: string,
    targetId: string
  ): Promise<EntityMergeSideTableSnapshot> {
    const rows: MergeSideTableRow[] = [];
    const addRows = (
      table: MergeTrackedTable,
      selected: SqlRow[],
      entityColumn: string,
      idColumns: string[],
      uniqueColumns: string[] | null
    ) => {
      for (const row of selected) {
        rows.push({
          table,
          rowId: mergeRowId(
            Object.fromEntries(idColumns.map(column => [column, row[column] ?? null]))
          ),
          entityId: text(row[entityColumn]),
          uniqueKey:
            uniqueColumns == null || uniqueColumns.some(column => row[column] == null)
              ? null
              : mergeRowId(Object.fromEntries(uniqueColumns.map(column => [column, row[column]]))),
          dedupeKey: mergeRowDedupeKey(row, entityColumn, idColumns)
        });
      }
    };

    addRows(
      'entity_grant',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM entity_grant
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      ['principal_type', 'principal_id']
    );
    addRows(
      'content_node',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM content_node
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      ['path']
    );
    addRows(
      'content_mount',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM content_mount
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      ['destination_path']
    );
    addRows(
      'diagram_entity_ref',
      await this.sql<SqlRow[]>`
        SELECT workspace, file_id, entity_id
        FROM diagram_entity_ref
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['workspace', 'file_id', 'entity_id'],
      ['workspace', 'file_id']
    );
    addRows(
      'user_watch',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM user_watch
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['user_id', 'workspace', 'entity_id'],
      ['user_id', 'workspace']
    );
    addRows(
      'user_notification',
      await this.sql<SqlRow[]>`
        SELECT n.*, n.resource_id AS entity_id
        FROM user_inbox_notification n
        WHERE n.workspace = ${workspace}
          AND n.resource_type = 'entity'
          AND n.resource_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      null
    );
    addRows(
      'user_pinned_entity',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM user_pinned_entity
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['user_id', 'workspace', 'entity_id'],
      ['user_id', 'workspace']
    );
    addRows(
      'user_collection_entity',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM user_collection_entity
        WHERE entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['collection_id', 'entity_id'],
      ['collection_id']
    );
    addRows(
      'project_entity',
      await this.sql<SqlRow[]>`
        SELECT workspace, project_id, entity_id
        FROM project_entity
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['workspace', 'project_id', 'entity_id'],
      ['workspace', 'project_id']
    );
    addRows(
      'assessment_response',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM assessment_response
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      ['assessment_id', 'occurrence']
    );
    addRows(
      'document_link_index',
      await this.sql<SqlRow[]>`
        SELECT workspace, node_id, field_id, target_type, target_id, position
        FROM document_link_index
        WHERE workspace = ${workspace}
          AND target_type = 'entity'
          AND target_id IN (${sourceId}, ${targetId})
      `,
      'target_id',
      ['workspace', 'node_id', 'field_id', 'target_type', 'target_id', 'position'],
      ['workspace', 'node_id', 'field_id', 'target_type', 'position']
    );
    addRows(
      'record_version',
      await this.sql<SqlRow[]>`
        SELECT id, workspace, record_id, version_number
        FROM record_version
        WHERE workspace = ${workspace} AND record_id IN (${sourceId}, ${targetId})
      `,
      'record_id',
      ['id'],
      ['version_number']
    );
    addRows(
      'record_change_case_record_version',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM record_change_case_record_version
        WHERE workspace = ${workspace} AND record_id IN (${sourceId}, ${targetId})
      `,
      'record_id',
      ['id'],
      ['revision_id']
    );
    addRows(
      'entity_deprecation_ack',
      await this.sql<SqlRow[]>`
        SELECT a.*, c.subject_id AS entity_id
        FROM entity_deprecation_ack a
        JOIN governance_case c ON c.id = a.case_id AND c.workspace = a.workspace
        WHERE a.workspace = ${workspace}
          AND c.subject_type = 'entity'
          AND c.subject_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      null
    );
    addRows(
      'catalog_artifact',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM catalog_artifact
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      ['artifact_type', 'source_key']
    );
    addRows(
      'conformance_violation',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM conformance_violation
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['id'],
      ['check_id']
    );
    addRows(
      'conformance_entity_evaluation',
      await this.sql<SqlRow[]>`
        SELECT *
        FROM conformance_entity_evaluation
        WHERE workspace = ${workspace} AND entity_id IN (${sourceId}, ${targetId})
      `,
      'entity_id',
      ['workspace', 'check_id', 'entity_id'],
      ['check_id']
    );
    addRows(
      'discussion_post',
      await this.sql<SqlRow[]>`
        SELECT id, workspace, object_id
        FROM discussion_post
        WHERE workspace = ${workspace}
          AND object_type = 'entity'
          AND object_id IN (${sourceId}, ${targetId})
      `,
      'object_id',
      ['id'],
      null
    );
    addRows(
      'governance_case',
      await this.sql<SqlRow[]>`
        SELECT id, workspace, subject_id
        FROM governance_case
        WHERE workspace = ${workspace}
          AND subject_type = 'entity'
          AND subject_id IN (${sourceId}, ${targetId})
      `,
      'subject_id',
      ['id'],
      null
    );

    const externalIdentityRows = (
      await this.sql<SqlRow[]>`
        SELECT source, external_key, record_id
        FROM catalog_record_external_identity
        WHERE workspace = ${workspace} AND record_id IN (${sourceId}, ${targetId})
      `
    ).map(row => ({
      source: text(row['source']),
      externalKey: text(row['external_key']),
      recordId: text(row['record_id'])
    }));

    return {
      rows,
      conflicts: buildMergeSideTableConflicts(rows, sourceId, targetId),
      externalIdentityRows
    };
  }

  async lockRecords(workspace: string, recordIds: string[]) {
    for (const recordId of recordIds) {
      await this.sql`
        SELECT id FROM catalog_record
        WHERE workspace = ${workspace} AND id = ${recordId}
        FOR UPDATE
      `;
    }
  }

  async releaseSourceIdentity(
    workspace: string,
    sourceId: string,
    expectedVersion: number,
    temporarySlug: string,
    temporaryNamespace: string
  ) {
    const result = await this.sql`
      UPDATE catalog_record
      SET slug = ${temporarySlug}, namespace = ${temporaryNamespace}
      WHERE workspace = ${workspace} AND id = ${sourceId}
        AND kind = 'entity' AND version = ${expectedVersion}
    `;
    return result.count > 0;
  }

  private async deleteSideRow(table: MergeTrackedTable, rowId: string) {
    const row = parseRowId(rowId);
    switch (table) {
      case 'entity_grant':
        await this.sql`DELETE FROM entity_grant WHERE id = ${parameter(row['id'])}`;
        return;
      case 'content_node':
        await this.sql`DELETE FROM content_node WHERE id = ${parameter(row['id'])}`;
        return;
      case 'content_mount':
        await this.sql`DELETE FROM content_mount WHERE id = ${parameter(row['id'])}`;
        return;
      case 'diagram_entity_ref':
        await this.sql`
          DELETE FROM diagram_entity_ref
          WHERE workspace = ${parameter(row['workspace'])} AND file_id = ${parameter(row['file_id'])}
            AND entity_id = ${parameter(row['entity_id'])}
        `;
        return;
      case 'user_watch':
        await this.sql`
          DELETE FROM user_watch
          WHERE user_id = ${parameter(row['user_id'])} AND workspace = ${parameter(row['workspace'])}
            AND entity_id = ${parameter(row['entity_id'])}
        `;
        return;
      case 'user_notification':
        await this.sql`
          DELETE FROM user_inbox_notification
          WHERE id = ${parameter(row['id'])} AND resource_type = 'entity'
        `;
        return;
      case 'user_pinned_entity':
        await this.sql`
          DELETE FROM user_pinned_entity
          WHERE user_id = ${parameter(row['user_id'])} AND workspace = ${parameter(row['workspace'])}
            AND entity_id = ${parameter(row['entity_id'])}
        `;
        return;
      case 'user_collection_entity':
        await this.sql`
          DELETE FROM user_collection_entity
          WHERE collection_id = ${parameter(row['collection_id'])} AND entity_id = ${parameter(row['entity_id'])}
        `;
        return;
      case 'project_entity':
        await this.sql`
          DELETE FROM project_entity
          WHERE workspace = ${parameter(row['workspace'])} AND project_id = ${parameter(row['project_id'])}
            AND entity_id = ${parameter(row['entity_id'])}
        `;
        return;
      case 'assessment_response':
        await this.sql`DELETE FROM assessment_response WHERE id = ${parameter(row['id'])}`;
        return;
      case 'document_link_index':
        await this.sql`
          DELETE FROM document_link_index
          WHERE workspace = ${parameter(row['workspace'])} AND node_id = ${parameter(row['node_id'])}
            AND field_id = ${parameter(row['field_id'])} AND target_type = ${parameter(row['target_type'])}
            AND target_id = ${parameter(row['target_id'])} AND position = ${parameter(row['position'])}
        `;
        return;
      case 'record_version':
        await this.sql`DELETE FROM record_version WHERE id = ${parameter(row['id'])}`;
        return;
      case 'record_change_case_record_version':
        await this
          .sql`DELETE FROM record_change_case_record_version WHERE id = ${parameter(row['id'])}`;
        return;
      case 'entity_deprecation_ack':
        await this.sql`DELETE FROM entity_deprecation_ack WHERE id = ${parameter(row['id'])}`;
        return;
      case 'catalog_artifact':
        await this.sql`DELETE FROM catalog_artifact WHERE id = ${parameter(row['id'])}`;
        return;
      case 'conformance_violation':
        await this.sql`DELETE FROM conformance_violation WHERE id = ${parameter(row['id'])}`;
        return;
      case 'conformance_entity_evaluation':
        await this.sql`
          DELETE FROM conformance_entity_evaluation
          WHERE workspace = ${parameter(row['workspace'])} AND check_id = ${parameter(row['check_id'])}
            AND entity_id = ${parameter(row['entity_id'])}
        `;
        return;
      case 'discussion_post':
        await this.sql`DELETE FROM discussion_post WHERE id = ${parameter(row['id'])}`;
        return;
      case 'governance_case':
        await this.sql`DELETE FROM governance_case WHERE id = ${parameter(row['id'])}`;
        return;
    }
  }

  async applySideTableRewrites(
    workspace: string,
    sourceId: string,
    targetId: string,
    resolutions: Record<string, MergeRelationResolution>
  ) {
    const snapshot = await this.getSideTableSnapshot(workspace, sourceId, targetId);
    const autoDedupeRowIds = new Set(
      buildMergeSideTableAutoDedupeRowIds(snapshot.rows, sourceId, targetId)
    );
    for (const row of snapshot.rows.filter(candidate => autoDedupeRowIds.has(candidate.rowId))) {
      await this.deleteSideRow(row.table, row.rowId);
    }
    for (const conflict of snapshot.conflicts) {
      const resolution = resolutions[conflict.conflictId];
      if (resolution === 'keep_source') {
        if (conflict.targetRowId) await this.deleteSideRow(conflict.table, conflict.targetRowId);
      } else if (resolution === 'keep_target' || resolution === 'drop_source') {
        if (conflict.sourceRowId) await this.deleteSideRow(conflict.table, conflict.sourceRowId);
      } else {
        throw new Error(`Missing side-table resolution for ${conflict.conflictId}`);
      }
    }

    await this
      .sql`UPDATE entity_grant SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE content_node SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE content_mount SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE diagram_entity_ref SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE user_watch SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE user_inbox_notification SET resource_id = ${targetId} WHERE workspace = ${workspace} AND resource_type = 'entity' AND resource_id = ${sourceId}`;
    await this
      .sql`UPDATE user_pinned_entity SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE user_collection_entity SET entity_id = ${targetId} WHERE entity_id = ${sourceId}`;
    await this
      .sql`UPDATE project_entity SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE assessment_response SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE document_link_index SET target_id = ${targetId} WHERE workspace = ${workspace} AND target_type = 'entity' AND target_id = ${sourceId}`;
    await this
      .sql`UPDATE record_change_case_record_version SET record_id = ${targetId} WHERE workspace = ${workspace} AND record_id = ${sourceId}`;
    await this
      .sql`UPDATE catalog_artifact SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE conformance_violation SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE conformance_entity_evaluation SET entity_id = ${targetId} WHERE workspace = ${workspace} AND entity_id = ${sourceId}`;
    await this
      .sql`UPDATE discussion_post SET object_id = ${targetId} WHERE workspace = ${workspace} AND object_type = 'entity' AND object_id = ${sourceId}`;
    await this
      .sql`UPDATE governance_case SET subject_id = ${targetId} WHERE workspace = ${workspace} AND subject_type = 'entity' AND subject_id = ${sourceId}`;
  }

  private async deleteRelation(workspace: string, relationId: string) {
    await this.sql`
      DELETE FROM relation_endpoint_pair_key
      WHERE workspace = ${workspace} AND relation_id = ${relationId}
    `;
    await this.sql`
      DELETE FROM catalog_record
      WHERE workspace = ${workspace} AND id = ${relationId} AND kind = 'relation'
    `;
  }

  private async updateRelationEndpoint(
    workspace: string,
    relation: RelationDbResult,
    inEntityId: string,
    outEntityId: string
  ) {
    if (inEntityId === outEntityId) throw new Error('Entity merge would create a self-relation');
    await this.sql`
      DELETE FROM relation_endpoint_pair_key
      WHERE workspace = ${workspace} AND relation_id = ${relation.id}
    `;
    await this.sql`
      UPDATE catalog_record
      SET in_record_id = ${inEntityId}, out_record_id = ${outEntityId},
          version = version + 1, updated_at = NOW()
      WHERE workspace = ${workspace} AND id = ${relation.id}
        AND kind = 'relation' AND deleted_at IS NULL
    `;
    await this.sql`
      INSERT INTO relation_endpoint_pair_key
        (workspace, schema_id, in_entity_id, out_entity_id, relation_id)
      SELECT r.workspace, r.schema_id, r.in_record_id, r.out_record_id, r.id
      FROM catalog_record r
      JOIN relation_schema rs ON rs.workspace = r.workspace AND rs.id = r.schema_id
      WHERE r.workspace = ${workspace} AND r.id = ${relation.id}
        AND rs.unique_endpoint_pair = TRUE
    `;
  }

  async applyRelationRewrites(
    workspace: string,
    sourceId: string,
    targetId: string,
    sourceRelations: RelationDbResult[],
    conflicts: MergeRelationConflict[],
    resolutions: Record<string, MergeRelationResolution>
  ) {
    const conflictsByRelationId = new Map(
      conflicts.map(conflict => [conflict.relationId, conflict])
    );
    for (const relation of sourceRelations) {
      if (relation.in_entity_id !== sourceId && relation.out_entity_id !== sourceId) continue;
      const conflict = conflictsByRelationId.get(relation.id);
      const repointedIn = relation.in_entity_id === sourceId ? targetId : relation.in_entity_id;
      const repointedOut = relation.out_entity_id === sourceId ? targetId : relation.out_entity_id;

      if (conflict?.note === 'self') {
        if (resolutions[relation.id] !== 'drop_source') {
          throw new Error(`Self relation ${relation.id} must be dropped during an entity merge`);
        }
        await this.deleteRelation(workspace, relation.id);
        continue;
      }
      if (conflict?.note === 'duplicate') {
        if (resolutions[relation.id] === 'keep_source') {
          if (conflict.duplicateRelationId) {
            await this.deleteRelation(workspace, conflict.duplicateRelationId);
          }
          await this.updateRelationEndpoint(workspace, relation, repointedIn, repointedOut);
        } else if (
          resolutions[relation.id] === 'keep_target' ||
          resolutions[relation.id] === 'drop_source'
        ) {
          await this.deleteRelation(workspace, relation.id);
        } else {
          throw new Error(`Missing relation resolution for ${relation.id}`);
        }
        continue;
      }
      await this.updateRelationEndpoint(workspace, relation, repointedIn, repointedOut);
    }
  }

  async moveRecordVersions(workspace: string, sourceId: string, targetId: string) {
    const [maxRow] = await this.sql<{ max_version: number | string }[]>`
      SELECT COALESCE(MAX(version_number), 0) AS max_version
      FROM record_version
      WHERE workspace = ${workspace} AND record_id = ${targetId}
    `;
    let nextVersion = Number(maxRow?.max_version ?? 0) + 1;
    const sourceVersions = await this.sql<{ id: string }[]>`
      SELECT id
      FROM record_version
      WHERE workspace = ${workspace} AND record_id = ${sourceId}
      ORDER BY version_number, id
    `;
    for (const version of sourceVersions) {
      await this.sql`
        UPDATE record_version
        SET record_id = ${targetId}, version_number = ${nextVersion}
        WHERE workspace = ${workspace} AND id = ${version.id}
      `;
      nextVersion++;
    }
  }

  async deleteSourceRecord(workspace: string, sourceId: string, expectedVersion: number) {
    const result = await this.sql`
      DELETE FROM catalog_record
      WHERE workspace = ${workspace} AND id = ${sourceId}
        AND kind = 'entity' AND version = ${expectedVersion}
    `;
    return result.count > 0;
  }

  async countRemainingReferences(workspace: string, recordId: string) {
    const [row] = await this.sql<{ count: number | string }[]>`
      SELECT COALESCE(SUM(ref_count), 0) AS count
      FROM (
        SELECT COUNT(*) AS ref_count FROM catalog_record
          WHERE workspace = ${workspace} AND kind = 'relation'
            AND (in_record_id = ${recordId} OR out_record_id = ${recordId})
        UNION ALL SELECT COUNT(*) FROM entity_grant WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM content_node WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM content_mount WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM diagram_entity_ref WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM user_watch WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM user_inbox_notification WHERE workspace = ${workspace} AND resource_type = 'entity' AND resource_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM user_pinned_entity WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM user_collection_entity WHERE entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM project_entity WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM assessment_response WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM document_link_index WHERE workspace = ${workspace} AND target_type = 'entity' AND target_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM record_version WHERE workspace = ${workspace} AND record_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM record_change_case_record_version WHERE workspace = ${workspace} AND record_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM catalog_artifact WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM conformance_violation WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM conformance_entity_evaluation WHERE workspace = ${workspace} AND entity_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM discussion_post WHERE workspace = ${workspace} AND object_type = 'entity' AND object_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM governance_case WHERE workspace = ${workspace} AND subject_type = 'entity' AND subject_id = ${recordId}
        UNION ALL SELECT COUNT(*) FROM catalog_record_external_identity WHERE workspace = ${workspace} AND record_id = ${recordId}
      ) references
    `;
    return Number(row?.count ?? 0);
  }
}
