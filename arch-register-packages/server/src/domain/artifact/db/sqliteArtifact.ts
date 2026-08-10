import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  ArtifactDatabase,
  ArtifactRevisionDbCreate,
  ArtifactDbCreate,
  ArtifactDbUpdate
} from './artifactDatabase';
import { artifactMappers } from './artifactDatabase';

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

export class SqliteArtifactDatabase extends SqliteDatabaseBase implements ArtifactDatabase {
  async listArtifacts(workspace: string, entityId: string) {
    return this.all(
      'SELECT * FROM catalog_artifact WHERE workspace = ? AND entity_id = ? ORDER BY created_at, id',
      [workspace, entityId],
      artifactMappers.artifact
    );
  }

  async getArtifact(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM catalog_artifact WHERE workspace = ? AND id = ?',
      [workspace, id],
      artifactMappers.artifact
    );
  }

  async createArtifact(input: ArtifactDbCreate) {
    this.run(
      `INSERT INTO catalog_artifact
       (id, workspace, entity_id, artifact_type, kind, location, media_type, status, current_revision_id,
        last_attempt_at, last_success_at, diagnostic_category, diagnostic_message, diagnostic_timestamp,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.entity_id,
        input.artifact_type,
        input.kind,
        input.location,
        input.media_type,
        input.status,
        null,
        null,
        null,
        null,
        null,
        null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getArtifact(input.workspace, input.id))!;
  }

  async updateArtifact(workspace: string, id: string, input: ArtifactDbUpdate) {
    const existing = await this.getArtifact(workspace, id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.run(
      `UPDATE catalog_artifact SET status = ?, media_type = ?, current_revision_id = ?, last_attempt_at = ?,
       last_success_at = ?, diagnostic_category = ?, diagnostic_message = ?, diagnostic_timestamp = ?, updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        next.status,
        next.media_type,
        next.current_revision_id,
        iso(next.last_attempt_at),
        iso(next.last_success_at),
        next.diagnostic?.category ?? null,
        next.diagnostic?.message ?? null,
        iso(next.diagnostic?.timestamp),
        next.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return this.getArtifact(workspace, id);
  }

  async beginAttempt(workspace: string, id: string, timestamp: Date) {
    const existing = await this.getArtifact(workspace, id);
    if (!existing) return null;
    if (existing.status === 'pending') return { artifact: existing, started: false };

    const result = this.run(
      `UPDATE catalog_artifact SET status = 'pending', last_attempt_at = ?,
       diagnostic_category = NULL, diagnostic_message = NULL, diagnostic_timestamp = NULL,
       updated_at = ?
       WHERE workspace = ? AND id = ? AND status <> 'pending'`,
      [timestamp.toISOString(), timestamp.toISOString(), workspace, id]
    );
    const artifact = await this.getArtifact(workspace, id);
    return artifact ? { artifact, started: result.changes > 0 } : null;
  }

  async listRevisionSummaries(workspace: string, artifactId: string) {
    return this.all(
      `SELECT id, workspace, artifact_id, source_revision, checksum, media_type,
              length(CAST(content AS BLOB)) AS content_size, created_at
       FROM catalog_artifact_revision
       WHERE workspace = ? AND artifact_id = ?
       ORDER BY created_at DESC, id DESC`,
      [workspace, artifactId],
      artifactMappers.revisionSummary
    );
  }

  async getRevision(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM catalog_artifact_revision WHERE workspace = ? AND id = ?',
      [workspace, id],
      artifactMappers.revision
    );
  }

  async getRevisionByChecksum(workspace: string, sourceId: string, checksum: string) {
    return this.get(
      'SELECT * FROM catalog_artifact_revision WHERE workspace = ? AND artifact_id = ? AND checksum = ?',
      [workspace, sourceId, checksum],
      artifactMappers.revision
    );
  }

  async createRevision(input: ArtifactRevisionDbCreate) {
    this.run(
      `INSERT INTO catalog_artifact_revision
       (id, workspace, artifact_id, source_revision, checksum, media_type, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.artifact_id,
        input.source_revision,
        input.checksum,
        input.media_type,
        input.content,
        input.created_at.toISOString()
      ]
    );
    return (await this.getRevision(input.workspace, input.id))!;
  }
}
