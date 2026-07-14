import type { DatabaseRow } from '../../../db/rowMappers';
import { mapDatabaseRows } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type {
  ExternalContentDatabase,
  ExternalContentMountDbCreate,
  ExternalContentSourceDbCreate
} from './externalContentDatabase';
import { externalContentMappers } from './externalContentDatabase';

export class PostgresExternalContentDatabase extends PostgresDatabaseBase implements ExternalContentDatabase {
  async createSource(input: ExternalContentSourceDbCreate) {
    try {
      const rows = await this.sql`
        INSERT INTO external_content_source
          (id, workspace, source_type, source_config, identity_key, schedule_id, enabled, status,
           last_attempt_at, last_synced_at, last_revision, last_error, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.source_type}, ${this.json(input.source_config)},
          ${input.identity_key}, ${input.schedule_id}, ${input.enabled}, ${input.status},
          ${input.last_attempt_at ?? null}, ${input.last_synced_at ?? null}, ${input.last_revision ?? null}, ${input.last_error ?? null},
          ${input.created_at}, ${input.updated_at}) RETURNING *
      `;
      const row = rows[0] as unknown as DatabaseRow | undefined;
      return externalContentMappers.source(row!);
    } catch (error) { return normalizePostgresError(error); }
  }

  async getSource(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM external_content_source WHERE workspace = ${workspace} AND id = ${id}`;
    return row ? externalContentMappers.source(row) : null;
  }

  async getSourceByIdentity(workspace: string, sourceType: 'git', identityKey: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM external_content_source WHERE workspace = ${workspace} AND source_type = ${sourceType} AND identity_key = ${identityKey}`;
    return row ? externalContentMappers.source(row) : null;
  }

  async listSources(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`SELECT * FROM external_content_source WHERE workspace = ${workspace} ORDER BY created_at, id`;
    return mapDatabaseRows(rows, externalContentMappers.source);
  }

  async updateSource(id: string, input: Parameters<ExternalContentDatabase['updateSource']>[1]) {
    const existing = await this.getById(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE external_content_source SET schedule_id = ${next.schedule_id}, enabled = ${next.enabled},
          status = ${next.status}, last_attempt_at = ${next.last_attempt_at}, last_synced_at = ${next.last_synced_at},
          last_revision = ${next.last_revision}, last_error = ${next.last_error}, updated_at = ${next.updated_at}
        WHERE id = ${id} RETURNING *
      `;
      return row ? externalContentMappers.source(row) : null;
    } catch (error) { return normalizePostgresError(error); }
  }

  private async getById(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM external_content_source WHERE id = ${id}`;
    return row ? externalContentMappers.source(row) : null;
  }

  async deleteSource(workspace: string, id: string) {
    try { await this.sql`DELETE FROM external_content_source WHERE workspace = ${workspace} AND id = ${id}`; }
    catch (error) { return normalizePostgresError(error); }
  }

  async createMount(input: ExternalContentMountDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO content_mount
          (id, workspace, source_id, project_id, entity_id, destination_path, source_path, status,
           last_synced_at, last_revision, last_error, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.source_id}, ${input.project_id}, ${input.entity_id},
          ${input.destination_path}, ${input.source_path}, ${input.status}, ${input.last_synced_at},
          ${input.last_revision}, ${input.last_error}, ${input.created_at}, ${input.updated_at}) RETURNING *
      `;
      return externalContentMappers.mount(row!);
    } catch (error) { return normalizePostgresError(error); }
  }

  async getMount(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM content_mount WHERE workspace = ${workspace} AND id = ${id}`;
    return row ? externalContentMappers.mount(row) : null;
  }

  async listMounts(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`SELECT * FROM content_mount WHERE workspace = ${workspace} ORDER BY destination_path, id`;
    return mapDatabaseRows(rows, externalContentMappers.mount);
  }

  async listMountsBySource(workspace: string, sourceId: string) {
    const rows = await this.sql<DatabaseRow[]>`SELECT * FROM content_mount WHERE workspace = ${workspace} AND source_id = ${sourceId} ORDER BY destination_path, id`;
    return mapDatabaseRows(rows, externalContentMappers.mount);
  }

  async updateMount(id: string, input: Parameters<ExternalContentDatabase['updateMount']>[1]) {
    const existing = await this.getByMountId(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE content_mount SET status = ${next.status}, last_synced_at = ${next.last_synced_at},
          last_revision = ${next.last_revision}, last_error = ${next.last_error}, updated_at = ${next.updated_at}
        WHERE id = ${id} RETURNING *
      `;
      return row ? externalContentMappers.mount(row) : null;
    } catch (error) { return normalizePostgresError(error); }
  }

  private async getByMountId(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM content_mount WHERE id = ${id}`;
    return row ? externalContentMappers.mount(row) : null;
  }

  async deleteMount(workspace: string, id: string) {
    try { await this.sql`DELETE FROM content_mount WHERE workspace = ${workspace} AND id = ${id}`; }
    catch (error) { return normalizePostgresError(error); }
  }
}
