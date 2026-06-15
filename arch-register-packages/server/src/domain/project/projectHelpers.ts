import type { ProjectDbResult, ProjectEntityDbResult } from './db/projectDatabase';
import type { ContentNodeDbResult as InternalProjectFile } from './db/projectDatabase';
import type { AuthorizationContext } from '@arch-register/permissions';
import {
  FileTree,
  Project,
  ProjectDetail,
  ProjectEntity,
  ProjectFile
} from '@arch-register/api-types/projectContract';

const getProjectCapabilities = (
  context: AuthorizationContext | null,
  _ownerTeamId: string | null
) => {
  if (!context) {
    return {
      canEdit: true,
      canDelete: true,
      canManageFiles: true
    };
  }

  // TODO: Implement proper project permission checking using _ownerTeamId
  // For now, use workspace-level permissions
  return {
    canEdit: true,
    canDelete: true,
    canManageFiles: true
  };
};

export const toApiProject = (
  project: ProjectDbResult,
  fileCount: number,
  authCtx: AuthorizationContext | null
): Project => ({
  id: project.id,
  public_id: project.public_id ?? project.id,
  workspace: project.workspace,
  name: project.name,
  description: project.description,
  owner: project.owner ? { id: project.owner, name: project.owner_name ?? project.owner } : null,
  status: project.status,
  color: project.color,
  target_date: project.target_date,
  pinned: project.pinned,
  file_count: fileCount,
  created_at: project.created_at.toISOString(),
  updated_at: project.updated_at.toISOString(),
  ...getProjectCapabilities(authCtx, project.owner)
});

export const toApiProjectEntity = (row: ProjectEntityDbResult): ProjectEntity => ({
  entity_id: row.entity_id,
  entity_name: row.entity_name,
  entity_slug: row.entity_slug,
  entity_description: row.entity_description,
  entity_schema: row.entity_schema_id
    ? { id: row.entity_schema_id, name: row.entity_schema_name ?? row.entity_schema_id }
    : null,
  entity_type: row.entity_type_id
    ? { id: row.entity_type_id, name: row.entity_type_label ?? row.entity_type_id }
    : null,
  is_done: row.is_done
});

export const toApiProjectFile = (file: InternalProjectFile): ProjectFile => ({
  id: file.id,
  project_id: file.project_id,
  project_public_id: file.project_public_id ?? null,
  path: file.path,
  name: file.name,
  size_bytes: file.size_bytes,
  comment_count: file.comment_count,
  unresolved_comment_count: file.unresolved_comment_count,
  is_template: file.is_template,
  is_workspace_template: file.is_workspace_template,
  preview_svg: file.preview_svg,
  created_at: file.created_at.toISOString(),
  updated_at: file.updated_at.toISOString(),
  type: file.type
});

export const toApiProjectDetail = (
  project: ProjectDbResult,
  files: FileTree,
  authCtx: AuthorizationContext | null
): ProjectDetail => ({
  id: project.id,
  public_id: project.public_id ?? project.id,
  workspace: project.workspace,
  name: project.name,
  description: project.description,
  owner: project.owner ? { id: project.owner, name: project.owner_name ?? project.owner } : null,
  status: project.status,
  color: project.color,
  target_date: project.target_date,
  pinned: project.pinned,
  file_count: files.folders.reduce((sum, f) => sum + f.files.length, 0) + files.rootFiles.length,
  created_at: project.created_at.toISOString(),
  updated_at: project.updated_at.toISOString(),
  ...getProjectCapabilities(authCtx, project.owner),
  files
});
