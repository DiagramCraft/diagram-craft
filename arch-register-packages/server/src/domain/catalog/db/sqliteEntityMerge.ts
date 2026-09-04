import type { MergeRelationConflict } from '@arch-register/api-types/entityMergeContract';
import type { RelationDbResult } from './relationDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
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

const parseRowId = (rowId: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(rowId);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid entity merge side-table row identity');
  }
  return parsed as Record<string, unknown>;
};

export class SqliteEntityMergeDatabase extends SqliteDatabaseBase implements EntityMergeDatabase {
  async getSideTableSnapshot(
    workspace: string,
    sourceId: string,
    targetId: string
  ): Promise<EntityMergeSideTableSnapshot> {
    const rows: MergeSideTableRow[] = [];
    const params = [workspace, sourceId, targetId];
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
      this.all<SqlRow>(
        'SELECT * FROM entity_grant WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['id'],
      ['principal_type', 'principal_id']
    );
    addRows(
      'content_node',
      this.all<SqlRow>(
        'SELECT * FROM content_node WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['id'],
      ['path']
    );
    addRows(
      'content_mount',
      this.all<SqlRow>(
        'SELECT * FROM content_mount WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['id'],
      ['destination_path']
    );
    addRows(
      'diagram_entity_ref',
      this.all<SqlRow>(
        'SELECT workspace, file_id, entity_id FROM diagram_entity_ref WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['workspace', 'file_id', 'entity_id'],
      ['workspace', 'file_id']
    );
    addRows(
      'user_watch',
      this.all<SqlRow>(
        'SELECT * FROM user_watch WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['user_id', 'workspace', 'entity_id'],
      ['user_id', 'workspace']
    );
    addRows(
      'user_notification',
      this.all<SqlRow>(
        "SELECT n.*, n.resource_id AS entity_id FROM user_inbox_notification n WHERE n.workspace = ? AND n.resource_type = 'entity' AND n.resource_id IN (?, ?)",
        params
      ),
      'entity_id',
      ['id'],
      null
    );
    addRows(
      'user_pinned_entity',
      this.all<SqlRow>(
        'SELECT * FROM user_pinned_entity WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['user_id', 'workspace', 'entity_id'],
      ['user_id', 'workspace']
    );
    addRows(
      'user_collection_entity',
      this.all<SqlRow>('SELECT * FROM user_collection_entity WHERE entity_id IN (?, ?)', [
        sourceId,
        targetId
      ]),
      'entity_id',
      ['collection_id', 'entity_id'],
      ['collection_id']
    );
    addRows(
      'project_entity',
      this.all<SqlRow>(
        'SELECT workspace, project_id, entity_id FROM project_entity WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['workspace', 'project_id', 'entity_id'],
      ['workspace', 'project_id']
    );
    addRows(
      'assessment_response',
      this.all<SqlRow>(
        'SELECT * FROM assessment_response WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['id'],
      ['assessment_id', 'occurrence']
    );
    addRows(
      'document_link_index',
      this.all<SqlRow>(
        "SELECT workspace, node_id, field_id, target_type, target_id, position FROM document_link_index WHERE workspace = ? AND target_type = 'entity' AND target_id IN (?, ?)",
        params
      ),
      'target_id',
      ['workspace', 'node_id', 'field_id', 'target_type', 'target_id', 'position'],
      ['workspace', 'node_id', 'field_id', 'target_type', 'position']
    );
    addRows(
      'record_version',
      this.all<SqlRow>(
        'SELECT id, workspace, record_id, version_number FROM record_version WHERE workspace = ? AND record_id IN (?, ?)',
        params
      ),
      'record_id',
      ['id'],
      ['version_number']
    );
    addRows(
      'record_change_case_record_version',
      this.all<SqlRow>(
        'SELECT * FROM record_change_case_record_version WHERE workspace = ? AND record_id IN (?, ?)',
        params
      ),
      'record_id',
      ['id'],
      ['revision_id']
    );
    addRows(
      'entity_deprecation_ack',
      this.all<SqlRow>(
        `SELECT a.*, c.subject_id AS entity_id
         FROM entity_deprecation_ack a
         JOIN governance_case c ON c.id = a.case_id AND c.workspace = a.workspace
         WHERE a.workspace = ? AND c.subject_type = 'entity' AND c.subject_id IN (?, ?)`,
        params
      ),
      'entity_id',
      ['id'],
      null
    );
    addRows(
      'catalog_artifact',
      this.all<SqlRow>(
        'SELECT * FROM catalog_artifact WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['id'],
      ['artifact_type', 'source_key']
    );
    addRows(
      'conformance_violation',
      this.all<SqlRow>(
        'SELECT * FROM conformance_violation WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['id'],
      ['check_id']
    );
    addRows(
      'conformance_entity_evaluation',
      this.all<SqlRow>(
        'SELECT * FROM conformance_entity_evaluation WHERE workspace = ? AND entity_id IN (?, ?)',
        params
      ),
      'entity_id',
      ['workspace', 'check_id', 'entity_id'],
      ['check_id']
    );
    addRows(
      'discussion_post',
      this.all<SqlRow>(
        "SELECT id, workspace, object_id FROM discussion_post WHERE workspace = ? AND object_type = 'entity' AND object_id IN (?, ?)",
        params
      ),
      'object_id',
      ['id'],
      null
    );
    addRows(
      'governance_case',
      this.all<SqlRow>(
        "SELECT id, workspace, subject_id FROM governance_case WHERE workspace = ? AND subject_type = 'entity' AND subject_id IN (?, ?)",
        params
      ),
      'subject_id',
      ['id'],
      null
    );

    const externalIdentityRows = this.all<SqlRow>(
      'SELECT source, external_key, record_id FROM catalog_record_external_identity WHERE workspace = ? AND record_id IN (?, ?)',
      params
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
    if (recordIds.length === 0) return;
    this.all(
      'SELECT id FROM catalog_record WHERE workspace = ? AND id IN (' +
        recordIds.map(() => '?').join(', ') +
        ')',
      [workspace, ...recordIds]
    );
  }

  async releaseSourceIdentity(
    workspace: string,
    sourceId: string,
    expectedVersion: number,
    temporarySlug: string,
    temporaryNamespace: string
  ) {
    const result = this.run(
      "UPDATE catalog_record SET slug = ?, namespace = ? WHERE workspace = ? AND id = ? AND kind = 'entity' AND version = ?",
      [temporarySlug, temporaryNamespace, workspace, sourceId, expectedVersion]
    );
    return result.changes > 0;
  }

  private deleteSideRow(table: MergeTrackedTable, rowId: string) {
    const row = parseRowId(rowId);
    switch (table) {
      case 'entity_grant':
        this.run('DELETE FROM entity_grant WHERE id = ?', [row['id']]);
        return;
      case 'content_node':
        this.run('DELETE FROM content_node WHERE id = ?', [row['id']]);
        return;
      case 'content_mount':
        this.run('DELETE FROM content_mount WHERE id = ?', [row['id']]);
        return;
      case 'diagram_entity_ref':
        this.run(
          'DELETE FROM diagram_entity_ref WHERE workspace = ? AND file_id = ? AND entity_id = ?',
          [row['workspace'], row['file_id'], row['entity_id']]
        );
        return;
      case 'user_watch':
        this.run('DELETE FROM user_watch WHERE user_id = ? AND workspace = ? AND entity_id = ?', [
          row['user_id'],
          row['workspace'],
          row['entity_id']
        ]);
        return;
      case 'user_notification':
        this.run("DELETE FROM user_inbox_notification WHERE id = ? AND resource_type = 'entity'", [
          row['id']
        ]);
        return;
      case 'user_pinned_entity':
        this.run(
          'DELETE FROM user_pinned_entity WHERE user_id = ? AND workspace = ? AND entity_id = ?',
          [row['user_id'], row['workspace'], row['entity_id']]
        );
        return;
      case 'user_collection_entity':
        this.run('DELETE FROM user_collection_entity WHERE collection_id = ? AND entity_id = ?', [
          row['collection_id'],
          row['entity_id']
        ]);
        return;
      case 'project_entity':
        this.run(
          'DELETE FROM project_entity WHERE workspace = ? AND project_id = ? AND entity_id = ?',
          [row['workspace'], row['project_id'], row['entity_id']]
        );
        return;
      case 'assessment_response':
        this.run('DELETE FROM assessment_response WHERE id = ?', [row['id']]);
        return;
      case 'document_link_index':
        this.run(
          'DELETE FROM document_link_index WHERE workspace = ? AND node_id = ? AND field_id = ? AND target_type = ? AND target_id = ? AND position = ?',
          [
            row['workspace'],
            row['node_id'],
            row['field_id'],
            row['target_type'],
            row['target_id'],
            row['position']
          ]
        );
        return;
      case 'record_version':
        this.run('DELETE FROM record_version WHERE id = ?', [row['id']]);
        return;
      case 'record_change_case_record_version':
        this.run('DELETE FROM record_change_case_record_version WHERE id = ?', [row['id']]);
        return;
      case 'entity_deprecation_ack':
        this.run('DELETE FROM entity_deprecation_ack WHERE id = ?', [row['id']]);
        return;
      case 'catalog_artifact':
        this.run('DELETE FROM catalog_artifact WHERE id = ?', [row['id']]);
        return;
      case 'conformance_violation':
        this.run('DELETE FROM conformance_violation WHERE id = ?', [row['id']]);
        return;
      case 'conformance_entity_evaluation':
        this.run(
          'DELETE FROM conformance_entity_evaluation WHERE workspace = ? AND check_id = ? AND entity_id = ?',
          [row['workspace'], row['check_id'], row['entity_id']]
        );
        return;
      case 'discussion_post':
        this.run('DELETE FROM discussion_post WHERE id = ?', [row['id']]);
        return;
      case 'governance_case':
        this.run('DELETE FROM governance_case WHERE id = ?', [row['id']]);
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
      this.deleteSideRow(row.table, row.rowId);
    }
    for (const conflict of snapshot.conflicts) {
      const resolution = resolutions[conflict.conflictId];
      if (resolution === 'keep_source') {
        if (conflict.targetRowId) this.deleteSideRow(conflict.table, conflict.targetRowId);
      } else if (resolution === 'keep_target' || resolution === 'drop_source') {
        if (conflict.sourceRowId) this.deleteSideRow(conflict.table, conflict.sourceRowId);
      } else {
        throw new Error(`Missing side-table resolution for ${conflict.conflictId}`);
      }
    }

    this.run('UPDATE entity_grant SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run('UPDATE content_node SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run('UPDATE content_mount SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run('UPDATE diagram_entity_ref SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run('UPDATE user_watch SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run(
      "UPDATE user_inbox_notification SET resource_id = ? WHERE workspace = ? AND resource_type = 'entity' AND resource_id = ?",
      [targetId, workspace, sourceId]
    );
    this.run('UPDATE user_pinned_entity SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run('UPDATE user_collection_entity SET entity_id = ? WHERE entity_id = ?', [
      targetId,
      sourceId
    ]);
    this.run('UPDATE project_entity SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run('UPDATE assessment_response SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run(
      "UPDATE document_link_index SET target_id = ? WHERE workspace = ? AND target_type = 'entity' AND target_id = ?",
      [targetId, workspace, sourceId]
    );
    this.run(
      'UPDATE record_change_case_record_version SET record_id = ? WHERE workspace = ? AND record_id = ?',
      [targetId, workspace, sourceId]
    );
    this.run('UPDATE catalog_artifact SET entity_id = ? WHERE workspace = ? AND entity_id = ?', [
      targetId,
      workspace,
      sourceId
    ]);
    this.run(
      'UPDATE conformance_violation SET entity_id = ? WHERE workspace = ? AND entity_id = ?',
      [targetId, workspace, sourceId]
    );
    this.run(
      'UPDATE conformance_entity_evaluation SET entity_id = ? WHERE workspace = ? AND entity_id = ?',
      [targetId, workspace, sourceId]
    );
    this.run(
      "UPDATE discussion_post SET object_id = ? WHERE workspace = ? AND object_type = 'entity' AND object_id = ?",
      [targetId, workspace, sourceId]
    );
    this.run(
      "UPDATE governance_case SET subject_id = ? WHERE workspace = ? AND subject_type = 'entity' AND subject_id = ?",
      [targetId, workspace, sourceId]
    );
  }

  private deleteRelation(workspace: string, relationId: string) {
    this.run('DELETE FROM relation_endpoint_pair_key WHERE workspace = ? AND relation_id = ?', [
      workspace,
      relationId
    ]);
    this.run("DELETE FROM catalog_record WHERE workspace = ? AND id = ? AND kind = 'relation'", [
      workspace,
      relationId
    ]);
  }

  private updateRelationEndpoint(
    workspace: string,
    relation: RelationDbResult,
    inEntityId: string,
    outEntityId: string
  ) {
    if (inEntityId === outEntityId) throw new Error('Entity merge would create a self-relation');
    this.run('DELETE FROM relation_endpoint_pair_key WHERE workspace = ? AND relation_id = ?', [
      workspace,
      relation.id
    ]);
    this.run(
      "UPDATE catalog_record SET in_record_id = ?, out_record_id = ?, version = version + 1, updated_at = datetime('now') WHERE workspace = ? AND id = ? AND kind = 'relation' AND deleted_at IS NULL",
      [inEntityId, outEntityId, workspace, relation.id]
    );
    this.run(
      `INSERT INTO relation_endpoint_pair_key (workspace, schema_id, in_entity_id, out_entity_id, relation_id)
       SELECT r.workspace, r.schema_id, r.in_record_id, r.out_record_id, r.id
       FROM catalog_record r
       JOIN relation_schema rs ON rs.workspace = r.workspace AND rs.id = r.schema_id
       WHERE r.workspace = ? AND r.id = ? AND rs.unique_endpoint_pair = 1`,
      [workspace, relation.id]
    );
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
        this.deleteRelation(workspace, relation.id);
        continue;
      }
      if (conflict?.note === 'duplicate') {
        if (resolutions[relation.id] === 'keep_source') {
          if (conflict.duplicateRelationId) {
            this.deleteRelation(workspace, conflict.duplicateRelationId);
          }
          this.updateRelationEndpoint(workspace, relation, repointedIn, repointedOut);
        } else if (
          resolutions[relation.id] === 'keep_target' ||
          resolutions[relation.id] === 'drop_source'
        ) {
          this.deleteRelation(workspace, relation.id);
        } else {
          throw new Error(`Missing relation resolution for ${relation.id}`);
        }
        continue;
      }
      this.updateRelationEndpoint(workspace, relation, repointedIn, repointedOut);
    }
  }

  async moveRecordVersions(workspace: string, sourceId: string, targetId: string) {
    const maxRow = this.get<{ max_version: number | string }>(
      'SELECT COALESCE(MAX(version_number), 0) AS max_version FROM record_version WHERE workspace = ? AND record_id = ?',
      [workspace, targetId]
    );
    let nextVersion = Number(maxRow?.max_version ?? 0) + 1;
    const sourceVersions = this.all<{ id: string }>(
      'SELECT id FROM record_version WHERE workspace = ? AND record_id = ? ORDER BY version_number, id',
      [workspace, sourceId]
    );
    for (const version of sourceVersions) {
      this.run(
        'UPDATE record_version SET record_id = ?, version_number = ? WHERE workspace = ? AND id = ?',
        [targetId, nextVersion, workspace, version.id]
      );
      nextVersion++;
    }
  }

  async deleteSourceRecord(workspace: string, sourceId: string, expectedVersion: number) {
    const result = this.run(
      "DELETE FROM catalog_record WHERE workspace = ? AND id = ? AND kind = 'entity' AND version = ?",
      [workspace, sourceId, expectedVersion]
    );
    return result.changes > 0;
  }

  async countRemainingReferences(workspace: string, recordId: string) {
    const count = (sql: string, params: unknown[]) =>
      Number(this.get<{ count: number | string }>(sql, params)?.count ?? 0);
    return [
      count(
        "SELECT COUNT(*) AS count FROM catalog_record WHERE workspace = ? AND kind = 'relation' AND (in_record_id = ? OR out_record_id = ?)",
        [workspace, recordId, recordId]
      ),
      count('SELECT COUNT(*) AS count FROM entity_grant WHERE workspace = ? AND entity_id = ?', [
        workspace,
        recordId
      ]),
      count('SELECT COUNT(*) AS count FROM content_node WHERE workspace = ? AND entity_id = ?', [
        workspace,
        recordId
      ]),
      count('SELECT COUNT(*) AS count FROM content_mount WHERE workspace = ? AND entity_id = ?', [
        workspace,
        recordId
      ]),
      count(
        'SELECT COUNT(*) AS count FROM diagram_entity_ref WHERE workspace = ? AND entity_id = ?',
        [workspace, recordId]
      ),
      count('SELECT COUNT(*) AS count FROM user_watch WHERE workspace = ? AND entity_id = ?', [
        workspace,
        recordId
      ]),
      count(
        "SELECT COUNT(*) AS count FROM user_inbox_notification WHERE workspace = ? AND resource_type = 'entity' AND resource_id = ?",
        [workspace, recordId]
      ),
      count(
        'SELECT COUNT(*) AS count FROM user_pinned_entity WHERE workspace = ? AND entity_id = ?',
        [workspace, recordId]
      ),
      count('SELECT COUNT(*) AS count FROM user_collection_entity WHERE entity_id = ?', [recordId]),
      count('SELECT COUNT(*) AS count FROM project_entity WHERE workspace = ? AND entity_id = ?', [
        workspace,
        recordId
      ]),
      count(
        'SELECT COUNT(*) AS count FROM assessment_response WHERE workspace = ? AND entity_id = ?',
        [workspace, recordId]
      ),
      count(
        "SELECT COUNT(*) AS count FROM document_link_index WHERE workspace = ? AND target_type = 'entity' AND target_id = ?",
        [workspace, recordId]
      ),
      count('SELECT COUNT(*) AS count FROM record_version WHERE workspace = ? AND record_id = ?', [
        workspace,
        recordId
      ]),
      count(
        'SELECT COUNT(*) AS count FROM record_change_case_record_version WHERE workspace = ? AND record_id = ?',
        [workspace, recordId]
      ),
      count(
        'SELECT COUNT(*) AS count FROM catalog_artifact WHERE workspace = ? AND entity_id = ?',
        [workspace, recordId]
      ),
      count(
        'SELECT COUNT(*) AS count FROM conformance_violation WHERE workspace = ? AND entity_id = ?',
        [workspace, recordId]
      ),
      count(
        'SELECT COUNT(*) AS count FROM conformance_entity_evaluation WHERE workspace = ? AND entity_id = ?',
        [workspace, recordId]
      ),
      count(
        "SELECT COUNT(*) AS count FROM discussion_post WHERE workspace = ? AND object_type = 'entity' AND object_id = ?",
        [workspace, recordId]
      ),
      count(
        "SELECT COUNT(*) AS count FROM governance_case WHERE workspace = ? AND subject_type = 'entity' AND subject_id = ?",
        [workspace, recordId]
      ),
      count(
        'SELECT COUNT(*) AS count FROM catalog_record_external_identity WHERE workspace = ? AND record_id = ?',
        [workspace, recordId]
      )
    ].reduce((total, value) => total + value, 0);
  }
}
