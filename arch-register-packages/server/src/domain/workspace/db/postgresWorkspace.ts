import {
  WorkspaceDbCreate,
  WorkspaceDbUpdate,
  WorkspaceDatabase,
  LifecycleStateDbCreate,
  OwnerDbCreate,
  TeamMembershipDbCreate,
  RoleDefinitionDbCreate,
  RoleDefinitionDbUpdate,
  ProjectEntityTypeDbCreate,
  TeamListOptions
} from './workspaceDatabase';
import { workspaceMappers } from './workspaceDatabase';
import type { ImportCacheEntry } from '../importCache';
import {
  normalizePostgresError,
  PostgresDatabaseBase,
  type PostgresSqlClient
} from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';

const withTransaction = async <T>(
  sql: PostgresSqlClient,
  callback: (tx: PostgresSqlClient) => Promise<T>
) => {
  const begin = (sql as unknown as { begin?: (fn: typeof callback) => Promise<T> }).begin;
  return typeof begin === 'function' ? await begin.call(sql, callback) : await callback(sql);
};

export class PostgresWorkspaceDatabase extends PostgresDatabaseBase implements WorkspaceDatabase {
  async listWorkspaces() {
    const rows = await this.sql<DatabaseRow[]>`SELECT *FROM workspace ORDER BY name`;
    return mapDatabaseRows(rows, workspaceMappers.workspace);
  }

  async getWorkspace(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace WHERE id = ${id}
    `;
    return row ? workspaceMappers.workspace(row) : null;
  }

  async createWorkspace(input: WorkspaceDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO workspace (id, name, url_slug, short_code, color, description, created_at, updated_at)
        VALUES (${input.id}, ${input.name}, ${input.url_slug}, ${input.short_code}, ${input.color}, ${input.description}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return workspaceMappers.workspace(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateWorkspace(id: string, input: WorkspaceDbUpdate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE workspace
        SET name = ${input.name},
            url_slug = ${input.url_slug},
            short_code = ${input.short_code},
            color = ${input.color},
            description = ${input.description},
            updated_at = ${input.updated_at}
        WHERE id = ${id}
        RETURNING *
      `;
      return row ? workspaceMappers.workspace(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteWorkspace(id: string) {
    try {
      const [workspace] = await this.sql<DatabaseRow[]>`
        SELECT * FROM workspace WHERE id = ${id}
      `;
      if (!workspace) return { workspace: null, projectIds: [] };

      const projects = await this.sql<{ id: string }[]>`
        SELECT id FROM project WHERE workspace = ${id}
      `;

      await withTransaction(this.sql, async tx => {
        await tx`DELETE FROM public_id_prefix WHERE owner_type = 'schema' AND owner_id IN (SELECT id FROM entity_schema WHERE workspace = ${id})`;
        await tx`DELETE FROM public_id_prefix WHERE owner_type = 'workspace' AND owner_id = ${id}`;
        await tx`DELETE FROM content_node WHERE workspace = ${id}`;
        await tx`DELETE FROM project WHERE workspace = ${id}`;
        await tx`DELETE FROM entity_grant WHERE workspace = ${id}`;
        await tx`DELETE FROM entity WHERE workspace = ${id}`;
        await tx`DELETE FROM entity_schema WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace_member WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace_role WHERE workspace = ${id}`;
        await tx`DELETE FROM team_membership WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace_lifecycle_state WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace_owner WHERE workspace = ${id}`;
        await tx`DELETE FROM audit_log WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace WHERE id = ${id}`;
      });

      return {
        workspace: workspace ? workspaceMappers.workspace(workspace) : null,
        projectIds: projects.map(project => project.id)
      };
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listLifecycleStates(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT id, workspace, label, color, sort_order, created_at, is_deprecated_state
      FROM workspace_lifecycle_state
      WHERE workspace = ${workspace}
      ORDER BY sort_order, id
    `;
    return mapDatabaseRows(rows, workspaceMappers.lifecycleState);
  }

  async replaceLifecycleStates(workspace: string, states: LifecycleStateDbCreate[]) {
    try {
      await withTransaction(this.sql, async tx => {
        const stateIds = states.map(state => state.id);

        if (stateIds.length === 0) {
          await tx`
            UPDATE entity
            SET lifecycle = NULL,
                target_lifecycle = NULL
            WHERE workspace = ${workspace}
          `;
          await tx`DELETE FROM workspace_lifecycle_state WHERE workspace = ${workspace}`;
          return;
        }

        await tx`
          UPDATE entity
          SET lifecycle = NULL
          WHERE workspace = ${workspace}
            AND lifecycle IS NOT NULL
            AND lifecycle NOT IN ${tx(stateIds)}
        `;
        await tx`
          UPDATE entity
          SET target_lifecycle = NULL
          WHERE workspace = ${workspace}
            AND target_lifecycle IS NOT NULL
            AND target_lifecycle NOT IN ${tx(stateIds)}
        `;
        await tx`
          DELETE FROM workspace_lifecycle_state
          WHERE workspace = ${workspace}
            AND id NOT IN ${tx(stateIds)}
        `;

        for (const state of states) {
          await tx`
            INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order, created_at, is_deprecated_state)
            VALUES (${state.id}, ${workspace}, ${state.label}, ${state.color}, ${state.sort_order}, ${state.created_at}, ${state.is_deprecated_state ?? false})
            ON CONFLICT (workspace, id) DO UPDATE SET
              label = EXCLUDED.label,
              color = EXCLUDED.color,
              sort_order = EXCLUDED.sort_order,
              is_deprecated_state = EXCLUDED.is_deprecated_state
          `;
        }
      });
      return await this.listLifecycleStates(workspace);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listProjectEntityTypes(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT id, workspace, label, sort_order, created_at
      FROM project_entity_type
      WHERE workspace = ${workspace}
      ORDER BY sort_order, id
    `;
    return mapDatabaseRows(rows, workspaceMappers.projectEntityType);
  }

  async replaceProjectEntityTypes(workspace: string, types: ProjectEntityTypeDbCreate[]) {
    try {
      await withTransaction(this.sql, async tx => {
        await tx`DELETE FROM project_entity_type WHERE workspace = ${workspace}`;
        for (const type of types) {
          await tx`
            INSERT INTO project_entity_type (id, workspace, label, sort_order, created_at)
            VALUES (${type.id}, ${workspace}, ${type.label}, ${type.sort_order}, ${type.created_at})
          `;
        }
      });
      return await this.listProjectEntityTypes(workspace);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listTeams(workspace: string, options?: TeamListOptions) {
    const query = options?.q?.trim();
    const limit =
      options?.limit == null
        ? query
          ? 50
          : undefined
        : Math.min(Math.max(Math.trunc(options.limit), 1), 100);
    const pattern = query ? `%${query.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const rows = await this.sql<DatabaseRow[]>`
      SELECT id, workspace, name, sort_order, color, description, created_at
      FROM workspace_owner
      WHERE workspace = ${workspace}
      AND ${pattern == null ? this.sql`TRUE` : this.sql`name ILIKE ${pattern} ESCAPE '\\'`}
      ORDER BY sort_order, id
      ${limit == null ? this.sql`` : this.sql`LIMIT ${limit}`}
    `;
    return mapDatabaseRows(rows, workspaceMappers.owner);
  }

  async replaceTeams(workspace: string, owners: OwnerDbCreate[]) {
    try {
      await withTransaction(this.sql, async tx => {
        const ownerIds = owners.map(owner => owner.id);

        if (ownerIds.length === 0) {
          await tx`DELETE FROM team_membership WHERE workspace = ${workspace}`;
          await tx`DELETE FROM workspace_owner WHERE workspace = ${workspace}`;
          return;
        }

        await tx`
          DELETE FROM team_membership
          WHERE workspace = ${workspace} AND team_id NOT IN ${tx(ownerIds)}
        `;
        await tx`
          DELETE FROM workspace_owner
          WHERE workspace = ${workspace} AND id NOT IN ${tx(ownerIds)}
        `;

        for (const owner of owners) {
          await tx`
            INSERT INTO workspace_owner (id, workspace, name, sort_order, color, description, created_at)
            VALUES (${owner.id}, ${workspace}, ${owner.name}, ${owner.sort_order}, ${owner.color}, ${owner.description}, ${owner.created_at})
            ON CONFLICT (workspace, id) DO UPDATE
            SET name = EXCLUDED.name,
                sort_order = EXCLUDED.sort_order,
                color = EXCLUDED.color,
                description = EXCLUDED.description,
                created_at = EXCLUDED.created_at
          `;
        }
      });
      return await this.listTeams(workspace);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listTeamAssignments(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT workspace, team_id, user_id, role, created_at
      FROM team_membership
      WHERE workspace = ${workspace}
      ORDER BY team_id, user_id
    `;
    return mapDatabaseRows(rows, workspaceMappers.teamMembership);
  }

  async replaceTeamAssignments(workspace: string, memberships: TeamMembershipDbCreate[]) {
    try {
      await withTransaction(this.sql, async tx => {
        await tx`DELETE FROM team_membership WHERE workspace = ${workspace}`;
        for (const membership of memberships) {
          await tx`
            INSERT INTO team_membership (workspace, team_id, user_id, role, created_at)
            VALUES (${workspace}, ${membership.team_id}, ${membership.user_id}, ${membership.role}, ${membership.created_at})
          `;
        }
      });
      return await this.listTeamAssignments(workspace);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listWorkspaceMembers(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT workspace, user_id, role, created_at
      FROM workspace_member
      WHERE workspace = ${workspace}
      ORDER BY role, user_id
    `;
    return mapDatabaseRows(rows, workspaceMappers.member);
  }

  async getWorkspaceMember(workspace: string, userId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT workspace, user_id, role, created_at
      FROM workspace_member
      WHERE workspace = ${workspace} AND user_id = ${userId}
    `;
    return row ? workspaceMappers.member(row) : null;
  }

  async setWorkspaceMemberRole(workspace: string, userId: string, role: string, createdAt: Date) {
    const [row] = await this.sql<DatabaseRow[]>`
      INSERT INTO workspace_member (workspace, user_id, role, created_at)
      VALUES (${workspace}, ${userId}, ${role}, ${createdAt})
      ON CONFLICT (workspace, user_id) DO UPDATE
      SET role = EXCLUDED.role
      RETURNING *
    `;
    return workspaceMappers.member(row!);
  }

  async removeWorkspaceMember(workspace: string, userId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      DELETE FROM workspace_member
      WHERE workspace = ${workspace} AND user_id = ${userId}
      RETURNING *
    `;
    return row ? workspaceMappers.member(row) : null;
  }

  async registerPublicIdPrefix(
    prefix: string,
    ownerType: 'workspace' | 'schema',
    ownerId: string,
    createdAt: Date
  ) {
    try {
      await this.sql`
        INSERT INTO public_id_prefix (prefix, owner_type, owner_id, next_number, created_at, updated_at)
        VALUES (${prefix}, ${ownerType}, ${ownerId}, 1, ${createdAt}, ${createdAt})
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updatePublicIdPrefix(
    oldPrefix: string,
    newPrefix: string,
    ownerType: 'workspace' | 'schema',
    ownerId: string,
    updatedAt: Date
  ) {
    try {
      await this.sql`
        UPDATE public_id_prefix
        SET prefix = ${newPrefix}, updated_at = ${updatedAt}
        WHERE prefix = ${oldPrefix} AND owner_type = ${ownerType} AND owner_id = ${ownerId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deletePublicIdPrefix(prefix: string) {
    try {
      await this.sql`DELETE FROM public_id_prefix WHERE prefix = ${prefix}`;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async allocatePublicId(prefix: string, updatedAt: Date) {
    try {
      const [row] = await this.sql<{ next_number: number }[]>`
        UPDATE public_id_prefix
        SET next_number = next_number + 1, updated_at = ${updatedAt}
        WHERE prefix = ${prefix}
        RETURNING next_number - 1 AS next_number
      `;
      if (!row) throw new Error(`Unknown public ID prefix '${prefix}'`);
      return row.next_number;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async setPublicIdNextNumber(prefix: string, nextNumber: number, updatedAt: Date) {
    try {
      await this.sql`
        UPDATE public_id_prefix SET next_number = ${nextNumber}, updated_at = ${updatedAt} WHERE prefix = ${prefix}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getWorkspaceRole(workspace: string, userId: string) {
    const member = await this.getWorkspaceMember(workspace, userId);
    return member?.role ?? null;
  }

  async listCustomWorkspaceRoles(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      FROM workspace_role
      WHERE workspace = ${workspace}
      ORDER BY name, id
    `;
    return mapDatabaseRows(rows, workspaceMappers.roleDefinition);
  }

  async getCustomWorkspaceRole(workspace: string, roleId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      FROM workspace_role
      WHERE workspace = ${workspace} AND id = ${roleId}
    `;
    return row ? workspaceMappers.roleDefinition(row) : null;
  }

  async createCustomWorkspaceRole(input: RoleDefinitionDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO workspace_role (id, workspace, name, description, tone, capabilities, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.tone}, ${this.json(input.capabilities)}, ${input.created_at}, ${input.updated_at})
        RETURNING id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      `;
      return workspaceMappers.roleDefinition(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateCustomWorkspaceRole(
    workspace: string,
    roleId: string,
    input: RoleDefinitionDbUpdate
  ) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE workspace_role
        SET name = ${input.name},
            description = ${input.description},
            tone = ${input.tone},
            capabilities = ${this.json(input.capabilities)},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${roleId}
        RETURNING id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      `;
      return row ? workspaceMappers.roleDefinition(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteCustomWorkspaceRole(workspace: string, roleId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      DELETE FROM workspace_role
      WHERE workspace = ${workspace} AND id = ${roleId}
      RETURNING id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
    `;
    return row ? workspaceMappers.roleDefinition(row) : null;
  }

  async countWorkspaceMembersByRole(workspace: string, roleId: string) {
    const [row] = await this.sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM workspace_member
      WHERE workspace = ${workspace} AND role = ${roleId}
    `;
    return row?.count ?? 0;
  }

  async storeImportCache(entry: ImportCacheEntry): Promise<void> {
    await this.sql`
      INSERT INTO import_cache (
        import_id, workspace_id, user_id, manifest, data, content_files, created_at, expires_at
      )
      VALUES (
        ${entry.import_id},
        ${entry.workspace_id},
        ${entry.user_id},
        ${this.json(entry.manifest)},
        ${this.json(entry.data)},
        ${entry.content_files ? this.json(entry.content_files) : null},
        ${entry.created_at},
        ${entry.expires_at}
      )
    `;
  }

  async getImportCache(importId: string): Promise<ImportCacheEntry | null> {
    const [row] = await this.sql<ImportCacheEntry[]>`
      SELECT import_id, workspace_id, user_id, manifest, data, content_files, created_at, expires_at
      FROM import_cache
      WHERE import_id = ${importId}
    `;
    return row ?? null;
  }

  async deleteImportCache(importId: string): Promise<void> {
    await this.sql`
      DELETE FROM import_cache
      WHERE import_id = ${importId}
    `;
  }

  async cleanupExpiredImportCache(): Promise<number> {
    const result = await this.sql`
      DELETE FROM import_cache
      WHERE expires_at < NOW()
    `;
    return result.count ?? 0;
  }
}
