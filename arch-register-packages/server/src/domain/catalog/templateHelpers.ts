import { toApiProjectFile } from '../project/projectHelpers';
import { ProjectFileDbResult } from '../project/db/projectDatabase';
import { ProjectTemplatesResponse } from '@arch-register/api-types/templateContract';

export type ProjectWithFiles = {
  project: { id: string };
  files: ProjectFileDbResult[];
};

export const buildAllTemplatesResponse = (
  projectsWithFiles: ProjectWithFiles[]
): {
  workspaceTemplates: ReturnType<typeof toApiProjectFile>[];
  projectTemplates: Record<string, ReturnType<typeof toApiProjectFile>[]>;
} => {
  const workspaceTemplates: ReturnType<typeof toApiProjectFile>[] = [];
  const projectTemplatesMap = new Map<string, ReturnType<typeof toApiProjectFile>[]>();

  for (const { project, files } of projectsWithFiles) {
    for (const file of files) {
      if (file.is_template) {
        const apiFile = toApiProjectFile(file);
        if (file.is_workspace_template) {
          workspaceTemplates.push(apiFile);
        } else {
          const projectTemplates = projectTemplatesMap.get(project.id) ?? [];
          projectTemplates.push(apiFile);
          projectTemplatesMap.set(project.id, projectTemplates);
        }
      }
    }
  }

  return {
    workspaceTemplates,
    projectTemplates: Object.fromEntries(projectTemplatesMap)
  };
};

export const buildProjectTemplatesResponse = (
  projectsWithFiles: ProjectWithFiles[],
  projectId: string
): ProjectTemplatesResponse => {
  const workspaceTemplates: ReturnType<typeof toApiProjectFile>[] = [];
  const projectTemplates: ReturnType<typeof toApiProjectFile>[] = [];

  for (const { project, files } of projectsWithFiles) {
    for (const file of files) {
      if (file.is_template) {
        const apiFile = toApiProjectFile(file);
        if (file.is_workspace_template) {
          workspaceTemplates.push(apiFile);
        } else if (project.id === projectId) {
          projectTemplates.push(apiFile);
        }
      }
    }
  }

  return { workspaceTemplates, projectTemplates };
};
