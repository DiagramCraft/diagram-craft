import { mapDatabaseRow, type DatabaseRow } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type {
  ArtifactDatabase,
  ArtifactRevisionDbCreate,
  ArtifactDbCreate,
  ArtifactDbUpdate
} from './artifactDatabase';
import { artifactMappers } from './artifactDatabase';

export class PostgresArtifactDatabase extends PostgresDatabaseBase implements ArtifactDatabase {
  async listArtifacts(workspace: string, entityId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM catalog_artifact WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY created_at, id`;
    return rows.map(artifactMappers.artifact);
  }

  async getArtifact(workspace: string, id: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM catalog_artifact WHERE workspace = ${workspace} AND id = ${id}`;
    return mapDatabaseRow(rows[0], artifactMappers.artifact);
  }

  async createArtifact(input: ArtifactDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO catalog_artifact
        (id, workspace, entity_id, artifact_type, kind, location, media_type, status, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.entity_id}, ${input.artifact_type}, ${input.kind}, ${input.location}, ${input.media_type},
          ${input.status}, ${input.created_at}, ${input.updated_at})
        RETURNING *`;
      return artifactMappers.artifact(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateArtifact(workspace: string, id: string, input: ArtifactDbUpdate) {
    const existing = await this.getArtifact(workspace, id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    try {
      const rows = await this.sql<DatabaseRow[]>`
        UPDATE catalog_artifact SET
          status = ${next.status}, current_revision_id = ${next.current_revision_id},
          last_attempt_at = ${next.last_attempt_at}, last_success_at = ${next.last_success_at},
          diagnostic_category = ${next.diagnostic?.category ?? null},
          diagnostic_message = ${next.diagnostic?.message ?? null},
          diagnostic_timestamp = ${next.diagnostic?.timestamp ?? null}, updated_at = ${next.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *`;
      return mapDatabaseRow(rows[0], artifactMappers.artifact);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getRevision(workspace: string, id: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM catalog_artifact_revision WHERE workspace = ${workspace} AND id = ${id}`;
    return mapDatabaseRow(rows[0], artifactMappers.revision);
  }

  async getRevisionByChecksum(workspace: string, sourceId: string, checksum: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM catalog_artifact_revision
      WHERE workspace = ${workspace} AND artifact_id = ${sourceId} AND checksum = ${checksum}`;
    return mapDatabaseRow(rows[0], artifactMappers.revision);
  }

  async createRevision(input: ArtifactRevisionDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO catalog_artifact_revision
        (id, workspace, artifact_id, source_revision, checksum, media_type, content, created_at)
        VALUES (${input.id}, ${input.workspace}, ${input.artifact_id}, ${input.source_revision}, ${input.checksum},
          ${input.media_type}, ${input.content}, ${input.created_at})
        RETURNING *`;
      return artifactMappers.revision(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
