import type { Project, ProjectFile, FileTree, ProjectDetail } from '@arch-register/api-types';
import type { EnrichedProject } from './db/projectDatabase';
import type { ProjectFile as InternalProjectFile } from '../../types';
import type { AuthorizationContext } from '@arch-register/permissions';

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
  project: EnrichedProject,
  fileCount: number,
  authCtx: AuthorizationContext | null
): Project => ({
  id: project.id,
  workspace: project.workspace,
  name: project.name,
  description: project.description,
  owner: project.owner ? { id: project.owner, name: project.owner_name ?? project.owner } : null,
  status: project.status,
  color: project.color,
  file_count: fileCount,
  created_at: project.created_at.toISOString(),
  updated_at: project.updated_at.toISOString(),
  ...getProjectCapabilities(authCtx, project.owner)
});

export const toApiProjectFile = (file: InternalProjectFile): ProjectFile => ({
  id: file.id,
  project_id: file.project_id,
  path: file.path,
  name: file.name,
  size_bytes: file.size_bytes,
  comment_count: file.comment_count,
  unresolved_comment_count: file.unresolved_comment_count,
  is_template: file.is_template,
  is_workspace_template: file.is_workspace_template,
  preview_svg: file.preview_svg,
  created_at: file.created_at.toISOString(),
  updated_at: file.updated_at.toISOString()
});

export const toApiProjectDetail = (
  project: EnrichedProject,
  files: FileTree,
  authCtx: AuthorizationContext | null
): ProjectDetail => ({
  id: project.id,
  workspace: project.workspace,
  name: project.name,
  description: project.description,
  owner: project.owner ? { id: project.owner, name: project.owner_name ?? project.owner } : null,
  status: project.status,
  color: project.color,
  file_count: files.folders.reduce((sum, f) => sum + f.files.length, 0) + files.rootFiles.length,
  created_at: project.created_at.toISOString(),
  updated_at: project.updated_at.toISOString(),
  ...getProjectCapabilities(authCtx, project.owner),
  files
});
