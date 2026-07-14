import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  ExternalContentDatabase,
  ExternalContentMountDbCreate,
  ExternalContentSourceDbCreate
} from './externalContentDatabase';
import { externalContentMappers } from './externalContentDatabase';

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

export class SqliteExternalContentDatabase extends SqliteDatabaseBase implements ExternalContentDatabase {
  async createSource(input: ExternalContentSourceDbCreate) {
    this.run(
      `INSERT INTO external_content_source
       (id, workspace, source_type, source_config, identity_key, schedule_id, enabled, status,
        last_attempt_at, last_synced_at, last_revision, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id, input.workspace, input.source_type, JSON.stringify(input.source_config),
        input.identity_key, input.schedule_id, input.enabled ? 1 : 0, input.status,
        iso(input.last_attempt_at), iso(input.last_synced_at), input.last_revision, input.last_error,
        input.created_at.toISOString(), input.updated_at.toISOString()
      ]
    );
    return (await this.getSource(input.workspace, input.id))!;
  }

  async getSource(workspace: string, id: string) {
    return this.get('SELECT * FROM external_content_source WHERE workspace = ? AND id = ?', [workspace, id], externalContentMappers.source);
  }

  async getSourceByIdentity(workspace: string, sourceType: 'git', identityKey: string) {
    return this.get(
      'SELECT * FROM external_content_source WHERE workspace = ? AND source_type = ? AND identity_key = ?',
      [workspace, sourceType, identityKey],
      externalContentMappers.source
    );
  }

  async listSources(workspace: string) {
    return this.all('SELECT * FROM external_content_source WHERE workspace = ? ORDER BY created_at, id', [workspace], externalContentMappers.source);
  }

  async updateSource(id: string, input: Parameters<ExternalContentDatabase['updateSource']>[1]) {
    const existing = await this.getById(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.run(
      `UPDATE external_content_source SET schedule_id = ?, enabled = ?, status = ?, last_attempt_at = ?,
       last_synced_at = ?, last_revision = ?, last_error = ?, updated_at = ? WHERE id = ?`,
      [next.schedule_id, next.enabled ? 1 : 0, next.status, iso(next.last_attempt_at), iso(next.last_synced_at), next.last_revision, next.last_error, next.updated_at.toISOString(), id]
    );
    return this.getSource(next.workspace, id);
  }

  private async getById(id: string) {
    return this.get('SELECT * FROM external_content_source WHERE id = ?', [id], externalContentMappers.source);
  }

  async deleteSource(workspace: string, id: string) {
    this.run('DELETE FROM external_content_source WHERE workspace = ? AND id = ?', [workspace, id]);
  }

  async createMount(input: ExternalContentMountDbCreate) {
    this.run(
      `INSERT INTO content_mount
       (id, workspace, source_id, project_id, entity_id, destination_path, source_path, status,
        last_synced_at, last_revision, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.workspace, input.source_id, input.project_id, input.entity_id, input.destination_path, input.source_path, input.status, iso(input.last_synced_at), input.last_revision, input.last_error, input.created_at.toISOString(), input.updated_at.toISOString()]
    );
    return (await this.getMount(input.workspace, input.id))!;
  }

  async getMount(workspace: string, id: string) {
    return this.get('SELECT * FROM content_mount WHERE workspace = ? AND id = ?', [workspace, id], externalContentMappers.mount);
  }

  async listMounts(workspace: string) {
    return this.all('SELECT * FROM content_mount WHERE workspace = ? ORDER BY destination_path, id', [workspace], externalContentMappers.mount);
  }

  async listMountsBySource(workspace: string, sourceId: string) {
    return this.all('SELECT * FROM content_mount WHERE workspace = ? AND source_id = ? ORDER BY destination_path, id', [workspace, sourceId], externalContentMappers.mount);
  }

  async updateMount(id: string, input: Parameters<ExternalContentDatabase['updateMount']>[1]) {
    const existing = await this.getByMountId(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.run(
      `UPDATE content_mount SET status = ?, last_synced_at = ?, last_revision = ?, last_error = ?, updated_at = ? WHERE id = ?`,
      [next.status, iso(next.last_synced_at), next.last_revision, next.last_error, next.updated_at.toISOString(), id]
    );
    return this.getMount(next.workspace, id);
  }

  private async getByMountId(id: string) {
    return this.get('SELECT * FROM content_mount WHERE id = ?', [id], externalContentMappers.mount);
  }

  async deleteMount(workspace: string, id: string) {
    this.run('DELETE FROM content_mount WHERE workspace = ? AND id = ?', [workspace, id]);
  }
}
