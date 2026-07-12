import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  canAccessProject,
  requireProjectAccess,
  requireProjectAction,
  requireWorkspaceAdmin
} from '../auth/authorization';
import { defineOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import { HTTPError } from 'h3';
import {
  buildAllTemplatesResponse,
  buildProjectTemplatesResponse,
  type ProjectWithFiles
} from './templateHelpers';
import type {
  SerializedDiagram,
  SerializedDiagramDocument
} from '@diagram-craft/model/serialization/serializedTypes';

const dbErrorMessages = {
  unique: 'Constraint violation',
  foreign: 'Foreign key constraint violation'
} as const;

const invalidTemplateDocumentError = (templatePath: string) =>
  new HTTPError({
    status: 400,
    statusText: 'Bad Request',
    message: `Template file '${templatePath}' does not contain a valid diagram document`
  });

const assertValidSerializedDiagram: (
  diagram: unknown,
  templatePath: string
) => asserts diagram is SerializedDiagram = (diagram, templatePath) => {
  if (
    !diagram ||
    typeof diagram !== 'object' ||
    !Array.isArray((diagram as { layers?: unknown }).layers) ||
    !Array.isArray((diagram as { diagrams?: unknown }).diagrams)
  ) {
    throw invalidTemplateDocumentError(templatePath);
  }

  const comments = (diagram as { comments?: unknown }).comments;
  if (comments !== undefined && !Array.isArray(comments)) {
    throw invalidTemplateDocumentError(templatePath);
  }

  for (const child of (diagram as { diagrams: unknown[] }).diagrams) {
    assertValidSerializedDiagram(child, templatePath);
  }
};

const parseTemplateDiagramDocument = (
  content: Buffer,
  templatePath: string
): SerializedDiagramDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.toString('utf8'));
  } catch {
    throw invalidTemplateDocumentError(templatePath);
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { diagrams?: unknown }).diagrams) ||
    !Array.isArray((parsed as { customPalette?: unknown }).customPalette) ||
    !Array.isArray((parsed as { schemas?: unknown }).schemas)
  ) {
    throw invalidTemplateDocumentError(templatePath);
  }

  const styles = (parsed as { styles?: unknown }).styles;
  if (
    !styles ||
    typeof styles !== 'object' ||
    !Array.isArray((styles as { edgeStyles?: unknown }).edgeStyles) ||
    !Array.isArray((styles as { nodeStyles?: unknown }).nodeStyles) ||
    !Array.isArray((styles as { textStyles?: unknown }).textStyles)
  ) {
    throw invalidTemplateDocumentError(templatePath);
  }

  for (const diagram of (parsed as { diagrams: unknown[] }).diagrams) {
    assertValidSerializedDiagram(diagram, templatePath);
  }

  return parsed as SerializedDiagramDocument;
};

export const listAllTemplates = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<ReturnType<typeof buildAllTemplatesResponse>> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve templates',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const projects = await db.project.listProjects(ws);
      const projectsWithFiles: ProjectWithFiles[] = [];

      for (const project of projects) {
        if (!canAccessProject(authCtx, project.owner)) continue;
        const files = await db.project.listContentNodes(ws, project.id);
        projectsWithFiles.push({ project, files });
      }

      return buildAllTemplatesResponse(projectsWithFiles);
    }
  );
};

export const listProjectTemplates = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<ReturnType<typeof buildProjectTemplatesResponse>> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve project templates',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, projectId);
      httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
      requireProjectAccess(authCtx, project.owner);

      const projects = await db.project.listProjects(ws);
      const projectsWithFiles: ProjectWithFiles[] = [];

      for (const proj of projects) {
        if (!canAccessProject(authCtx, proj.owner)) continue;
        const files = await db.project.listContentNodes(ws, proj.id);
        projectsWithFiles.push({ project: proj, files });
      }

      return buildProjectTemplatesResponse(projectsWithFiles, projectId);
    }
  );
};

export const toggleTemplateStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  filePath: string,
  is_template: boolean,
  is_workspace_template: boolean,
  event: AuthenticatedEvent
): Promise<ReturnType<typeof import('../project/projectHelpers').toApiProjectFile>> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update template status',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, projectId);
      httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });

      if (is_workspace_template) {
        requireWorkspaceAdmin(authCtx, 'Only workspace admins can manage workspace templates');
      } else {
        requireProjectAccess(authCtx, project.owner);
      }

      const file = await db.project.getContentNodeByPath(ws, projectId, filePath);
      httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

      await db.project.updateContentNodeTemplateStatus(
        ws,
        projectId,
        file.id,
        is_template,
        is_workspace_template,
        new Date()
      );

      const updatedFile = await db.project.getContentNodeByPath(ws, projectId, filePath);
      const { toApiProjectFile } = await import('../project/projectHelpers');
      return toApiProjectFile(updatedFile!);
    }
  );
};

export const createFromTemplate = async (
  db: DatabaseAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: Storage adapter type is complex and varies by implementation
  storage: any,
  workspace: string,
  projectId: string,
  name: string,
  templateProjectId: string,
  templatePath: string,
  folder: string | null | undefined,
  event: AuthenticatedEvent
): Promise<ReturnType<typeof import('../project/projectHelpers').toApiProjectFile>> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create from template',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, projectId);
      httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });

      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to modify this project'
      );

      const templateProject = await db.project.getProject(ws, templateProjectId);
      httpAssert.present(templateProject, {
        status: 404,
        message: `Template project '${templateProjectId}' not found`
      });
      requireProjectAccess(
        authCtx,
        templateProject.owner,
        'You do not have permission to view the source template project'
      );

      const templateFile = await db.project.getContentNodeByPath(
        ws,
        templateProjectId,
        templatePath
      );
      httpAssert.present(templateFile, {
        status: 404,
        message: `Template file '${templatePath}' not found`
      });
      httpAssert.true(templateFile.is_template, {
        status: 403,
        message: `File '${templatePath}' is not available as a template`
      });
      httpAssert.true(templateFile.is_workspace_template || templateProjectId === projectId, {
        status: 403,
        message: `Project template '${templatePath}' can only be used inside its own project`
      });

      const content = await storage.read(ws, templateProjectId, templateFile.id);
      const fileData = parseTemplateDiagramDocument(content, templatePath);

      if (fileData && typeof fileData === 'object' && 'name' in fileData) {
        fileData.name = name;
      }

      const newPath = folder ? `${folder}/${name}.json` : `${name}.json`;

      const existingFile = await db.project.getContentNodeByPath(ws, projectId, newPath);
      httpAssert.true(!existingFile, {
        status: 409,
        message: `A file already exists at '${newPath}'`
      });

      const timestamp = new Date();
      const newContent = Buffer.from(JSON.stringify(fileData), 'utf8');
      const { getDiagramCommentCounts } = await import('../diagram/commentCounts');

      const doc = fileData;
      const commentCounts = getDiagramCommentCounts(doc);

      const row = await db.project.upsertContentNode({
        workspace: ws,
        project_id: projectId,
        path: newPath,
        name,
        size_bytes: newContent.length,
        comment_count: commentCounts.commentCount,
        unresolved_comment_count: commentCounts.unresolvedCommentCount,
        created_atIfNew: timestamp,
        updated_at: timestamp
      });

      try {
        await storage.write(ws, projectId, row.id, newContent);
      } catch (error) {
        await db.project.deleteContentNodeByPath(ws, projectId, newPath).catch(() => {});
        throw error;
      }

      try {
        const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
        const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
        const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
        await db.project.updateContentNodeDerivedData(
          ws,
          projectId,
          row.id,
          newContent.length,
          commentCounts.commentCount,
          commentCounts.unresolvedCommentCount,
          previewSvg ?? null,
          timestamp
        );
      } catch {
        await db.project.updateContentNodeDerivedData(
          ws,
          projectId,
          row.id,
          newContent.length,
          commentCounts.commentCount,
          commentCounts.unresolvedCommentCount,
          null,
          timestamp
        );
      }

      const { logAudit, extractEntityFields } = await import('../audit/db/auditLogging');
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: row.name,
        changes: {
          new: extractEntityFields(row)
        },
        metadata: {
          project_id: projectId,
          path: newPath,
          created_from_template: templatePath,
          template_project_id: templateProjectId
        }
      });

      const { toApiProjectFile } = await import('../project/projectHelpers');
      return toApiProjectFile(row);
    }
  );
};
