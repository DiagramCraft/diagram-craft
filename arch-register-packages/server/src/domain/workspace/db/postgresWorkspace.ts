import {
  WorkspaceDbCreate,
  WorkspaceDbUpdate,
  WorkspaceDbResult,
  LifecycleStateDbResult,
  WorkspaceDatabase,
  OwnerDbResult,
  LifecycleStateDbCreate,
  MemberDbResult,
  TeamMembershipDbResult,
  OwnerDbCreate,
  RoleDefinitionDbResult,
  TeamMembershipDbCreate,
  RoleDefinitionDbCreate,
  RoleDefinitionDbUpdate,
  ProjectEntityTypeDbResult,
  ProjectEntityTypeDbCreate
} from './workspaceDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresWorkspaceDatabase extends PostgresDatabaseBase implements WorkspaceDatabase {
  async listWorkspaces() {
    return await this.sql<WorkspaceDbResult[]>`SELECT *FROM workspace ORDER BY name`;
  }

  async getWorkspace(id: string) {
    const [row] = await this.sql<WorkspaceDbResult[]>`
      SELECT * FROM workspace WHERE id = ${id}
    `;
    return row ?? null;
  }

  async createWorkspace(input: WorkspaceDbCreate) {
    try {
      const [row] = await this.sql<WorkspaceDbResult[]>`
        INSERT INTO workspace (id, name, url_slug, short_code, color, description, created_at, updated_at)
        VALUES (${input.id}, ${input.name}, ${input.url_slug}, ${input.short_code}, ${input.color}, ${input.description}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateWorkspace(id: string, input: WorkspaceDbUpdate) {
    try {
      const [row] = await this.sql<WorkspaceDbResult[]>`
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
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteWorkspace(id: string) {
    try {
      const [workspace] = await this.sql<WorkspaceDbResult[]>`
        SELECT * FROM workspace WHERE id = ${id}
      `;
      if (!workspace) return { workspace: null, projectIds: [] };

      const projects = await this.sql<{ id: string }[]>`
        SELECT id FROM project WHERE workspace = ${id}
      `;

      await this.sql.begin(async tx => {
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

      return { workspace, projectIds: projects.map(project => project.id) };
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listLifecycleStates(workspace: string) {
    return await this.sql<LifecycleStateDbResult[]>`
      SELECT id, workspace, label, color, sort_order, created_at
      FROM workspace_lifecycle_state
      WHERE workspace = ${workspace}
      ORDER BY sort_order, id
    `;
  }

  async replaceLifecycleStates(workspace: string, states: LifecycleStateDbCreate[]) {
    try {
      await this.sql.begin(async tx => {
        await tx`DELETE FROM workspace_lifecycle_state WHERE workspace = ${workspace}`;
        for (const state of states) {
          await tx`
            INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order, created_at)
            VALUES (${state.id}, ${workspace}, ${state.label}, ${state.color}, ${state.sort_order}, ${state.created_at})
          `;
        }
      });
      return await this.listLifecycleStates(workspace);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listProjectEntityTypes(workspace: string) {
    return await this.sql<ProjectEntityTypeDbResult[]>`
      SELECT id, workspace, label, sort_order, created_at
      FROM project_entity_type
      WHERE workspace = ${workspace}
      ORDER BY sort_order, id
    `;
  }

  async replaceProjectEntityTypes(workspace: string, types: ProjectEntityTypeDbCreate[]) {
    try {
      await this.sql.begin(async tx => {
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

  async listTeams(workspace: string) {
    return await this.sql<OwnerDbResult[]>`
      SELECT id, workspace, name, sort_order, color, description, created_at
      FROM workspace_owner
      WHERE workspace = ${workspace}
      ORDER BY sort_order, id
    `;
  }

  async replaceTeams(workspace: string, owners: OwnerDbCreate[]) {
    try {
      await this.sql.begin(async tx => {
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
    return await this.sql<TeamMembershipDbResult[]>`
      SELECT workspace, team_id, user_id, role, created_at
      FROM team_membership
      WHERE workspace = ${workspace}
      ORDER BY team_id, user_id
    `;
  }

  async replaceTeamAssignments(workspace: string, memberships: TeamMembershipDbCreate[]) {
    try {
      await this.sql.begin(async tx => {
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
    return await this.sql<MemberDbResult[]>`
      SELECT workspace, user_id, role, created_at
      FROM workspace_member
      WHERE workspace = ${workspace}
      ORDER BY role, user_id
    `;
  }

  async getWorkspaceMember(workspace: string, userId: string) {
    const [row] = await this.sql<MemberDbResult[]>`
      SELECT workspace, user_id, role, created_at
      FROM workspace_member
      WHERE workspace = ${workspace} AND user_id = ${userId}
    `;
    return row ?? null;
  }

  async setWorkspaceMemberRole(workspace: string, userId: string, role: string, createdAt: Date) {
    const [row] = await this.sql<MemberDbResult[]>`
      INSERT INTO workspace_member (workspace, user_id, role, created_at)
      VALUES (${workspace}, ${userId}, ${role}, ${createdAt})
      ON CONFLICT (workspace, user_id) DO UPDATE
      SET role = EXCLUDED.role
      RETURNING *
    `;
    return row!;
  }

  async removeWorkspaceMember(workspace: string, userId: string) {
    const [row] = await this.sql<MemberDbResult[]>`
      DELETE FROM workspace_member
      WHERE workspace = ${workspace} AND user_id = ${userId}
      RETURNING *
    `;
    return row ?? null;
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
    return await this.sql<RoleDefinitionDbResult[]>`
      SELECT id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      FROM workspace_role
      WHERE workspace = ${workspace}
      ORDER BY name, id
    `;
  }

  async getCustomWorkspaceRole(workspace: string, roleId: string) {
    const [row] = await this.sql<RoleDefinitionDbResult[]>`
      SELECT id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      FROM workspace_role
      WHERE workspace = ${workspace} AND id = ${roleId}
    `;
    return row ?? null;
  }

  async createCustomWorkspaceRole(input: RoleDefinitionDbCreate) {
    try {
      const [row] = await this.sql<RoleDefinitionDbResult[]>`
        INSERT INTO workspace_role (id, workspace, name, description, tone, capabilities, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.tone}, ${this.json(input.capabilities)}, ${input.created_at}, ${input.updated_at})
        RETURNING id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      `;
      return row!;
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
      const [row] = await this.sql<RoleDefinitionDbResult[]>`
        UPDATE workspace_role
        SET name = ${input.name},
            description = ${input.description},
            tone = ${input.tone},
            capabilities = ${this.json(input.capabilities)},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${roleId}
        RETURNING id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteCustomWorkspaceRole(workspace: string, roleId: string) {
    const [row] = await this.sql<RoleDefinitionDbResult[]>`
      DELETE FROM workspace_role
      WHERE workspace = ${workspace} AND id = ${roleId}
      RETURNING id, workspace, name, description, tone, FALSE AS builtin, capabilities, created_at, updated_at
    `;
    return row ?? null;
  }

  async countWorkspaceMembersByRole(workspace: string, roleId: string) {
    const [row] = await this.sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM workspace_member
      WHERE workspace = ${workspace} AND role = ${roleId}
    `;
    return row?.count ?? 0;
  }
}
