import type {
  GovernanceCaseConfigDatabase,
  GovernanceCaseConfigDbResult,
  GovernanceCaseConfigDbUpsert
} from './governanceCaseConfigDatabase';
import {
  GovernanceCaseConfigScopeConflictError,
  governanceCaseConfigMappers
} from './governanceCaseConfigDatabase';
import {
  normalizePostgresError,
  PostgresDatabaseBase,
  withPostgresTransaction
} from '../../../db/postgresBase';
import type { DatabaseRow } from '../../../db/rowMappers';
import { randomUUID } from 'node:crypto';

const hydrate = (rows: DatabaseRow[], scopeRows: DatabaseRow[]): GovernanceCaseConfigDbResult[] => {
  const byConfig = new Map<string, string[]>();
  for (const scope of scopeRows) {
    const id = String(scope['config_id']);
    byConfig.set(id, [...(byConfig.get(id) ?? []), String(scope['case_subkind'])]);
  }
  return rows.map(row =>
    governanceCaseConfigMappers.config(row, byConfig.get(String(row['id'])) ?? [])
  );
};

export class PostgresGovernanceCaseConfigDatabase
  extends PostgresDatabaseBase
  implements GovernanceCaseConfigDatabase
{
  async getCaseConfig(workspace: string, caseKind: string, caseSubkind: string | null) {
    const [row] =
      caseSubkind == null
        ? await this.sql<DatabaseRow[]>`
            SELECT * FROM workspace_governance_case_config
            WHERE workspace = ${workspace} AND case_kind = ${caseKind} AND workspace_wide
          `
        : await this.sql<DatabaseRow[]>`
            SELECT c.* FROM workspace_governance_case_config c
            JOIN workspace_governance_case_scope s ON s.config_id = c.id
            WHERE s.workspace = ${workspace} AND s.case_kind = ${caseKind}
              AND s.case_subkind = ${caseSubkind}
          `;
    return row ? this.withScope(row) : null;
  }

  async getCaseConfigById(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_case_config
      WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? this.withScope(row) : null;
  }

  private async withScope(row: DatabaseRow) {
    const scopeRows = await this.sql<DatabaseRow[]>`
      SELECT config_id, case_subkind FROM workspace_governance_case_scope
      WHERE config_id = ${String(row['id'])} ORDER BY case_subkind
    `;
    return hydrate([row], scopeRows)[0]!;
  }

  async listCaseConfig(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_case_config WHERE workspace = ${workspace}
      ORDER BY case_kind, name, id
    `;
    const scopeRows = await this.sql<DatabaseRow[]>`
      SELECT config_id, case_subkind FROM workspace_governance_case_scope
      WHERE workspace = ${workspace} ORDER BY case_subkind
    `;
    return hydrate(rows, scopeRows);
  }

  async listCaseConfigForKind(workspace: string, caseKind: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_case_config
      WHERE workspace = ${workspace} AND case_kind = ${caseKind}
      ORDER BY name, id
    `;
    const scopeRows = await this.sql<DatabaseRow[]>`
      SELECT config_id, case_subkind FROM workspace_governance_case_scope
      WHERE workspace = ${workspace} AND case_kind = ${caseKind} ORDER BY case_subkind
    `;
    return hydrate(rows, scopeRows);
  }

  async upsertCaseConfig(input: GovernanceCaseConfigDbUpsert) {
    const subkinds = [...new Set(input.case_subkinds)];
    const workspaceWide = subkinds.length === 0;

    try {
      const id = await withPostgresTransaction(this.sql, async sql => {
        let configId = input.id ?? null;
        if (!configId) {
          const [existing] = workspaceWide
            ? await sql<DatabaseRow[]>`
                SELECT id FROM workspace_governance_case_config
                WHERE workspace = ${input.workspace} AND case_kind = ${input.case_kind}
                  AND workspace_wide
              `
            : await sql<DatabaseRow[]>`
                SELECT config_id AS id FROM workspace_governance_case_scope
                WHERE workspace = ${input.workspace} AND case_kind = ${input.case_kind}
                  AND case_subkind = ${subkinds[0]!}
              `;
          configId = existing ? String(existing['id']) : randomUUID();
        }

        if (workspaceWide) {
          const [taken] = await sql<DatabaseRow[]>`
            SELECT id FROM workspace_governance_case_config
            WHERE workspace = ${input.workspace} AND case_kind = ${input.case_kind}
              AND workspace_wide AND id != ${configId}
          `;
          if (taken) throw new GovernanceCaseConfigScopeConflictError(input.case_kind, []);
        } else {
          const conflicts = await sql<DatabaseRow[]>`
            SELECT case_subkind FROM workspace_governance_case_scope
            WHERE workspace = ${input.workspace} AND case_kind = ${input.case_kind}
              AND config_id != ${configId} AND case_subkind IN ${sql(subkinds)}
            ORDER BY case_subkind
          `;
          if (conflicts.length > 0) {
            throw new GovernanceCaseConfigScopeConflictError(
              input.case_kind,
              conflicts.map(c => String(c['case_subkind']))
            );
          }
        }

        await sql`
          INSERT INTO workspace_governance_case_config (
            id, workspace, case_kind, workspace_wide, name, description, enabled, config,
            updated_at, updated_by
          ) VALUES (
            ${configId}, ${input.workspace}, ${input.case_kind}, ${workspaceWide},
            ${input.name}, ${input.description ?? null}, ${input.enabled},
            ${this.json(input.config)}, ${input.updated_at}, ${input.updated_by}
          )
          ON CONFLICT (id) DO UPDATE
          SET workspace_wide = excluded.workspace_wide,
              enabled = excluded.enabled,
              config = excluded.config,
              updated_at = excluded.updated_at,
              updated_by = excluded.updated_by,
              name = excluded.name,
              description = excluded.description
        `;
        await sql`DELETE FROM workspace_governance_case_scope WHERE config_id = ${configId}`;
        for (const subkind of subkinds) {
          await sql`
            INSERT INTO workspace_governance_case_scope (config_id, workspace, case_kind, case_subkind)
            VALUES (${configId}, ${input.workspace}, ${input.case_kind}, ${subkind})
          `;
        }
        return configId;
      });
      return (await this.getCaseConfigById(input.workspace, id))!;
    } catch (error) {
      if (error instanceof GovernanceCaseConfigScopeConflictError) throw error;
      return normalizePostgresError(error);
    }
  }

  async deleteCaseConfig(workspace: string, id: string) {
    const rows = await this.sql<DatabaseRow[]>`
      DELETE FROM workspace_governance_case_config
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING id
    `;
    return rows.length > 0;
  }

  async deleteCaseConfigForSubkindOrDescendants(workspace: string, subkindPrefix: string) {
    return withPostgresTransaction(this.sql, async sql => {
      const removed = await sql<DatabaseRow[]>`
        DELETE FROM workspace_governance_case_scope
        WHERE workspace = ${workspace}
          AND (case_subkind = ${subkindPrefix} OR case_subkind LIKE ${`${subkindPrefix}:%`})
        RETURNING config_id
      `;
      await sql`
        DELETE FROM workspace_governance_case_config c
        WHERE c.workspace = ${workspace} AND NOT c.workspace_wide
          AND NOT EXISTS (SELECT 1 FROM workspace_governance_case_scope s WHERE s.config_id = c.id)
      `;
      return new Set(removed.map(r => String(r['config_id']))).size;
    });
  }
}
