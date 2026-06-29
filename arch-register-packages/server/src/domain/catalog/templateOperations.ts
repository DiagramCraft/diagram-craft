import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { canAccessProject, requireProjectAccess } from '../auth/authorization';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { HTTPError } from 'h3';
import {
  buildAllTemplatesResponse,
  buildProjectTemplatesResponse,
  type ProjectWithFiles
} from './templateHelpers';
import type { SerializedDiagram, SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'Constraint violation',
    foreign: 'Foreign key constraint violation'
  });

const invalidTemplateDocumentError = (templatePath: string) =>
  new HTTPError({
    status: 400,
    statusText: 'Bad Request',
    message: `Template file '${templatePath}' does not contain a valid diagram document`
  });

const assertValidSerializedDiagram = (
  diagram: unknown,
  templatePath: string
): asserts diagram is SerializedDiagram => {
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
  authCtx: AuthorizationContext | null
): Promise<ReturnType<typeof buildAllTemplatesResponse>> => {
  try {
    const projects = await db.project.listProjects(workspace);
    const projectsWithFiles: ProjectWithFiles[] = [];

    for (const project of projects) {
      if (!authCtx || !canAccessProject(authCtx, project.owner)) continue;
      const files = await db.project.listContentNodes(workspace, project.id);
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
      const files = await db.project.listContentNodes(workspace, proj.id);
      projectsWithFiles.push({ project: proj, files });
    }

    return buildProjectTemplatesResponse(projectsWithFiles, projectId);
  } catch (error) {
    return handleError(error, 'Failed to retrieve project templates');
  }
};


export const toggleTemplateStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  filePath: string,
  is_template: boolean,
  is_workspace_template: boolean,
  authCtx: AuthorizationContext | null
): Promise<ReturnType<typeof import('../project/projectHelpers').toApiProjectFile>> => {
  try {
    const project = await db.project.getProject(workspace, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });

    if (is_workspace_template) {
      const { requireWorkspaceAdmin } = await import('../auth/authorization');
      httpAssert.present(authCtx, { status: 401, message: 'Authentication required' });
      requireWorkspaceAdmin(authCtx, 'Only workspace admins can manage workspace templates');
    } else {
      if (authCtx) requireProjectAccess(authCtx, project.owner);
    }

    const file = await db.project.getContentNodeByPath(workspace, projectId, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.updateContentNodeTemplateStatus(
      workspace,
      projectId,
      file.id,
      is_template,
      is_workspace_template,
      new Date()
    );

    const updatedFile = await db.project.getContentNodeByPath(workspace, projectId, filePath);
    const { toApiProjectFile } = await import('../project/projectHelpers');
    return toApiProjectFile(updatedFile!);
  } catch (error) {
    return handleError(error, 'Failed to update template status');
  }
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
  authCtx: AuthorizationContext | null
  ): Promise<ReturnType<typeof import('../project/projectHelpers').toApiProjectFile>> => {
  try {
    httpAssert.present(authCtx, { status: 401, message: 'Authentication required' });

    const project = await db.project.getProject(workspace, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });

    const { requireProjectAction } = await import('../auth/authorization');
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const templateProject = await db.project.getProject(workspace, templateProjectId);
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
      workspace,
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

    const content = await storage.read(workspace, templateProjectId, templateFile.id);
    const fileData = parseTemplateDiagramDocument(content, templatePath);

    if (fileData && typeof fileData === 'object' && 'name' in fileData) {
      fileData.name = name;
    }

    const newPath = folder ? `${folder}/${name}.json` : `${name}.json`;

    const existingFile = await db.project.getContentNodeByPath(workspace, projectId, newPath);
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
      workspace,
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
      await storage.write(workspace, projectId, row.id, newContent);
    } catch (error) {
      await db.project.deleteContentNodeByPath(workspace, projectId, newPath).catch(() => {});
      throw error;
    }

    try {
      const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
      const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
      const previewSvg =
        (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
      await db.project.updateContentNodeDerivedData(
        workspace,
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
        workspace,
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
      userId: authCtx?.userId ?? 'system',
      workspace,
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
  } catch (error) {
    return handleError(error, 'Failed to create from template');
  }
};
