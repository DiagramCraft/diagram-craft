import type {
  CreateProjectInput,
  EnrichedProject,
  ProjectDatabase,
  UpdateProjectInput,
  UpsertProjectFileInput
} from './projectDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { Project, ProjectFile } from '../../../types';

export class PostgresProjectDatabase extends PostgresDatabaseBase implements ProjectDatabase {
  async listProjects(workspace: string) {
    return await this.sql<EnrichedProject[]>`
      SELECT p.*, wo.name AS owner_name
      FROM project p
      LEFT JOIN workspace_owner wo ON wo.id = p.owner
      WHERE p.workspace = ${workspace}
      ORDER BY p.name
    `;
  }

  async getProject(workspace: string, id: string) {
    const [row] = await this.sql<EnrichedProject[]>`
      SELECT p.*, wo.name AS owner_name
      FROM project p
      LEFT JOIN workspace_owner wo ON wo.id = p.owner
      WHERE p.workspace = ${workspace} AND p.id = ${id}
    `;
    return row ?? null;
  }

  async createProject(input: CreateProjectInput) {
    try {
      await this.sql`
        INSERT INTO project (id, workspace, name, description, owner, status, color, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.owner}, ${input.status}, ${input.color}, ${input.created_at}, ${input.updated_at})
      `;
      return (await this.getProject(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProject(workspace: string, id: string, input: UpdateProjectInput) {
    try {
      const result = await this.sql`
        UPDATE project
        SET name = ${input.name},
            description = ${input.description},
            owner = ${input.owner},
            status = ${input.status},
            color = ${input.color},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
      `;
      if (result.count === 0) return null;
      return await this.getProject(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteProject(workspace: string, id: string) {
    try {
      const [row] = await this.sql<Project[]>`
        DELETE FROM project
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listProjectFiles(workspace: string, projectId: string) {
    return await this.sql<ProjectFile[]>`
      SELECT *
      FROM project_file
      WHERE workspace = ${workspace} AND project_id = ${projectId}
      ORDER BY path
    `;
  }

  async getProjectFileByPath(workspace: string, projectId: string, path: string) {
    const [row] = await this.sql<ProjectFile[]>`
      SELECT * FROM project_file
      WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
    `;
    return row ?? null;
  }

  async updateProjectFileSizeById(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET size_bytes = ${sizeBytes}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProjectFilePreview(
    workspace: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET preview_svg = ${previewSvg}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProjectFileDerivedData(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    commentCount: number,
    unresolvedCommentCount: number,
    previewSvg: string | null,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET size_bytes = ${sizeBytes},
            comment_count = ${commentCount},
            unresolved_comment_count = ${unresolvedCommentCount},
            preview_svg = ${previewSvg},
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProjectFileTemplateStatus(
    workspace: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET is_template = ${isTemplate}, is_workspace_template = ${isWorkspaceTemplate}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async upsertProjectFile(input: UpsertProjectFileInput) {
    try {
      const [row] = await this.sql<ProjectFile[]>`
        INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
        VALUES (gen_random_uuid(), ${input.workspace}, ${input.project_id}, ${input.path}, ${input.name}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
        ON CONFLICT (workspace, project_id, path)
        DO UPDATE SET
          name = EXCLUDED.name,
          size_bytes = EXCLUDED.size_bytes,
          comment_count = EXCLUDED.comment_count,
          unresolved_comment_count = EXCLUDED.unresolved_comment_count,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createProjectFileIfAbsent(
    input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }
  ) {
    try {
      const [row] = await this.sql<ProjectFile[]>`
        INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
        VALUES (gen_random_uuid(), ${input.workspace}, ${input.project_id}, ${input.path}, ${input.name}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
        ON CONFLICT (workspace, project_id, path) DO NOTHING
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteProjectFileByPath(workspace: string, projectId: string, path: string) {
    try {
      const [row] = await this.sql<ProjectFile[]>`
        DELETE FROM project_file
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async renameProjectFileFolder(
    workspace: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE project_file
        SET path = ${newPath} || substring(path from ${oldPath.length + 1}),
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path LIKE ${`${oldPath}/%`}
        RETURNING id
      `;
      return rows.map(row => row.id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteProjectFileFolder(workspace: string, projectId: string, folderPath: string) {
    try {
      return await this.sql<ProjectFile[]>`
        DELETE FROM project_file
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path LIKE ${`${folderPath}/%`}
        RETURNING *
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
