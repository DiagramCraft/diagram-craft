import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { canAccessProject, requireProjectAccess } from '../auth/authorization';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildAllTemplatesResponse,
  buildProjectTemplatesResponse,
  type ProjectWithFiles
} from './templateHelpers';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'Constraint violation',
    foreign: 'Foreign key constraint violation'
  });

export const listAllTemplates = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null
): Promise<ReturnType<typeof buildAllTemplatesResponse>> => {
  try {
    const projects = await db.project.listProjects(workspace);
    const projectsWithFiles: ProjectWithFiles[] = [];

    for (const project of projects) {
      if (!authCtx || !canAccessProject(authCtx, project.owner)) continue;
      const files = await db.project.listProjectFiles(workspace, project.id);
      projectsWithFiles.push({ project, files });
    }

    return buildAllTemplatesResponse(projectsWithFiles);
  } catch (error) {
    return handleError(error, 'Failed to retrieve templates');
  }
};

export const listProjectTemplates = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  authCtx: AuthorizationContext | null
): Promise<ReturnType<typeof buildProjectTemplatesResponse>> => {
  try {
    const project = await db.project.getProject(workspace, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    if (authCtx) requireProjectAccess(authCtx, project.owner);

    const projects = await db.project.listProjects(workspace);
    const projectsWithFiles: ProjectWithFiles[] = [];

    for (const proj of projects) {
      if (authCtx && !canAccessProject(authCtx, proj.owner)) continue;
      const files = await db.project.listProjectFiles(workspace, proj.id);
      projectsWithFiles.push({ project: proj, files });
    }

    return buildProjectTemplatesResponse(projectsWithFiles, projectId);
  } catch (error) {
    return handleError(error, 'Failed to retrieve project templates');
  }
};
