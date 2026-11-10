import { randomUUID } from 'node:crypto';
import type {
  SchemaChangeMode,
  SchemaDraftDatabase,
  SchemaDraftKind,
  SchemaDraftStageInput
} from './schemaDraftDatabase';
import { mapSchemaDraftItemRow, mapSchemaDraftRow } from './schemaDraftDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresSchemaDraftDatabase
  extends PostgresDatabaseBase
  implements SchemaDraftDatabase
{
  /** Creates the draft (expected 0) or bumps its revision. Returns the row, or null on mismatch. */
  private async bumpRevision(workspace: string, expectedRevision: number, userId: string | null) {
    const now = new Date();
    const [row] =
      expectedRevision === 0
        ? await this.sql<Record<string, unknown>[]>`
            INSERT INTO schema_draft (workspace, revision, created_by, updated_by, created_at, updated_at)
            VALUES (${workspace}, 1, ${userId}, ${userId}, ${now}, ${now})
            ON CONFLICT (workspace) DO NOTHING
            RETURNING *
          `
        : await this.sql<Record<string, unknown>[]>`
            UPDATE schema_draft
            SET revision = revision + 1, updated_by = ${userId}, updated_at = ${now}
            WHERE workspace = ${workspace} AND revision = ${expectedRevision}
            RETURNING *
          `;
    return row ? mapSchemaDraftRow(row) : null;
  }

  async getDraft(workspace: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM schema_draft WHERE workspace = ${workspace}
    `;
    return row ? mapSchemaDraftRow(row) : null;
  }

  async listItems(workspace: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM schema_draft_item WHERE workspace = ${workspace} ORDER BY kind, item_id
    `;
    return rows.map(mapSchemaDraftItemRow);
  }

  async stageItem(input: SchemaDraftStageInput, expectedRevision: number) {
    try {
      const draft = await this.bumpRevision(input.workspace, expectedRevision, input.updated_by);
      if (!draft) return null;
      const payload = input.payload == null ? null : this.sql.json(input.payload as never);
      await this.sql`
        INSERT INTO schema_draft_item (id, workspace, kind, item_id, op, payload, base_version, updated_by, updated_at)
        VALUES (${randomUUID()}, ${input.workspace}, ${input.kind}, ${input.item_id}, ${input.op},
                ${payload}, ${input.base_version}, ${input.updated_by}, ${new Date()})
        ON CONFLICT (workspace, kind, item_id) DO UPDATE SET
          op = EXCLUDED.op, payload = EXCLUDED.payload, base_version = EXCLUDED.base_version,
          updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
      `;
      return draft;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async unstageItem(
    workspace: string,
    kind: SchemaDraftKind,
    itemId: string,
    expectedRevision: number,
    updatedBy: string | null
  ) {
    try {
      if (expectedRevision === 0) return null;
      const draft = await this.bumpRevision(workspace, expectedRevision, updatedBy);
      if (!draft) return null;
      await this.sql`
        DELETE FROM schema_draft_item
        WHERE workspace = ${workspace} AND kind = ${kind} AND item_id = ${itemId}
      `;
      return draft;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async discard(workspace: string, expectedRevision: number) {
    try {
      const rows = await this.sql`
        DELETE FROM schema_draft
        WHERE workspace = ${workspace} AND revision = ${expectedRevision}
        RETURNING workspace
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getSchemaChangeMode(workspace: string): Promise<SchemaChangeMode> {
    const [row] = await this.sql<{ schema_change_mode: SchemaChangeMode }[]>`
      SELECT schema_change_mode FROM workspace_schema_settings WHERE workspace = ${workspace}
    `;
    return row?.schema_change_mode ?? 'direct';
  }

  async setSchemaChangeMode(workspace: string, mode: SchemaChangeMode, updatedBy: string | null) {
    try {
      await this.sql`
        INSERT INTO workspace_schema_settings (workspace, schema_change_mode, updated_at, updated_by)
        VALUES (${workspace}, ${mode}, ${new Date()}, ${updatedBy})
        ON CONFLICT (workspace) DO UPDATE SET
          schema_change_mode = EXCLUDED.schema_change_mode,
          updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
