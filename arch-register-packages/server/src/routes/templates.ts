import { H3, H3Event, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database';
import { resolveWorkspace } from '../api-helpers/resolveWorkspace';
import { handleDbError } from '../utils/http';
import {
  buildApiAuthCtx,
  requireProjectAccess,
  requireWorkspaceAdmin,
  canAccessProject
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../middleware/auth';
import { httpAssert } from '../utils/httpAssert';
import { toApiProjectFile } from '../api-helpers/project-helpers';
import {
  buildAllTemplatesResponse,
  buildProjectTemplatesResponse,
  type ProjectWithFiles
} from '../api-helpers/template-helpers';

const BASE = '/api/:workspace';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'Constraint violation',
    foreign: 'Foreign key constraint violation'
  });

export const decodeRouteParam = (value: string | undefined, name: string) => {
  httpAssert.present(value, { message: `${name} is required` });
  return decodeURIComponent(value);
};

export const buildTemplateStatusUpdateInput = (body: unknown) => {
  httpAssert.json(body, { message: 'Request body must be a JSON object' });

  const { is_template, is_workspace_template } = body as Record<string, unknown>;
  httpAssert.boolean(is_template, { message: 'is_template must be a boolean' });
  httpAssert.boolean(is_workspace_template, {
    message: 'is_workspace_template must be a boolean'
  });

  return {
    is_template,
    is_workspace_template
  };
};

const getParam = (event: H3Event, name: string) =>
  decodeRouteParam(event.context.params?.[name], name);

export const createTemplateRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  // GET /api/:workspace/templates
  // Returns all templates in the workspace (workspace-level and all project-level)
  router.get(
    `${BASE}/templates`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);

      try {
        const projects = await db.projectsFiles.listProjects(workspace);
        const projectsWithFiles: ProjectWithFiles[] = [];

        for (const project of projects) {
          if (!authCtx || !canAccessProject(authCtx, project.owner)) continue;
          const files = await db.projectsFiles.listProjectFiles(workspace, project.id);
          projectsWithFiles.push({ project, files });
        }

        return buildAllTemplatesResponse(projectsWithFiles);
      } catch (e) {
        handleError(e, 'Failed to retrieve templates');
      }
    })
  );

  // GET /api/:workspace/projects/:projectId/templates
  // Returns templates available for a specific project (workspace + project templates)
  router.get(
    `${BASE}/projects/:projectId/templates`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const projectId = getParam(event, 'projectId');
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);

      try {
        const project = await db.projectsFiles.getProject(workspace, projectId);
        httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
        requireProjectAccess(authCtx, project.owner);

        const projects = await db.projectsFiles.listProjects(workspace);
        const projectsWithFiles: ProjectWithFiles[] = [];

        for (const proj of projects) {
          if (authCtx && !canAccessProject(authCtx, proj.owner)) continue;
          const files = await db.projectsFiles.listProjectFiles(workspace, proj.id);
          projectsWithFiles.push({ project: proj, files });
        }

        return buildProjectTemplatesResponse(projectsWithFiles, projectId);
      } catch (e) {
        handleError(e, 'Failed to retrieve project templates');
      }
    })
  );

  // PUT /api/:workspace/projects/:projectId/template-status/:path
  // Toggle template status for a diagram
  router.put(
    `${BASE}/projects/:projectId/template-status/**:path`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const projectId = getParam(event, 'projectId');
      const filePath = getParam(event, 'path');

      const body = await event.req.json().catch(() => undefined);
      const { is_template, is_workspace_template } = buildTemplateStatusUpdateInput(body);

      try {
        const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
        const project = await db.projectsFiles.getProject(workspace, projectId);
        httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });

        // Check permissions
        if (is_workspace_template) {
          requireWorkspaceAdmin(authCtx, 'Only workspace admins can manage workspace templates');
        } else {
          requireProjectAccess(authCtx, project.owner);
        }

        const file = await db.projectsFiles.getProjectFileByPath(workspace, projectId, filePath);
        httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

        // Update template status in database
        await db.projectsFiles.updateProjectFileTemplateStatus(
          workspace,
          projectId,
          file.id,
          is_template,
          is_workspace_template,
          new Date()
        );

        // Return updated file
        const updatedFile = await db.projectsFiles.getProjectFileByPath(
          workspace,
          projectId,
          filePath
        );
        return toApiProjectFile(updatedFile!);
      } catch (e) {
        handleError(e, 'Failed to update template status');
      }
    })
  );

  return router;
};
