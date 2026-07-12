import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireProjectAccess, requireProjectAction } from '../auth/authorization';
import { handleError } from './projectOperationHelpers';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toApiProjectEntity } from './projectHelpers';
import type { DiagramEntityFile, ProjectEntity } from '@arch-register/api-types/projectContract';

export const listProjectEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<ProjectEntity[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAccess(authCtx, project.owner);
    const rows = await db.project.listProjectEntities(ws, project.id);
    return rows.map(toApiProjectEntity);
  } catch (e) {
    return handleError(e, 'Failed to retrieve project entities');
  }
};

export const addProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  input: { entity_id: string; entity_type?: string | null; is_done?: boolean },
  event: AuthenticatedEvent
): Promise<ProjectEntity> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to edit this project'
    );
    const row = await db.project.addProjectEntity({
      workspace: ws,
      project_id: project.id,
      entity_id: input.entity_id,
      entity_type_id: input.entity_type ?? null,
      is_done: input.is_done ?? false,
      created_at: new Date()
    });
    return toApiProjectEntity(row);
  } catch (e) {
    return handleError(e, 'Failed to add entity to project');
  }
};

export const updateProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  entityId: string,
  input: { entity_type?: string | null; is_done?: boolean },
  event: AuthenticatedEvent
): Promise<ProjectEntity> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to edit this project'
    );
    const existing = (await db.project.listProjectEntities(ws, project.id)).find(
      e => e.entity_id === entityId
    );
    httpAssert.present(existing, {
      status: 404,
      message: `Entity '${entityId}' not found in project`
    });
    const row = await db.project.updateProjectEntity(
      ws,
      project.id,
      entityId,
      input.entity_type !== undefined ? (input.entity_type ?? null) : existing.entity_type_id,
      input.is_done !== undefined ? input.is_done : existing.is_done
    );
    httpAssert.present(row, { status: 404, message: `Entity '${entityId}' not found in project` });
    return toApiProjectEntity(row);
  } catch (e) {
    return handleError(e, 'Failed to update project entity');
  }
};

export const removeProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  try {
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to edit this project'
    );
    await db.project.removeProjectEntity(ws, project.id, entityId);
    return { success: true };
  } catch (e) {
    return handleError(e, 'Failed to remove entity from project');
  }
};

export const getEntityProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<ProjectEntity[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  await buildApiAuthCtx(db, ws, event);
  try {
    const rows = await db.project.getEntityProjects(ws, entityId);
    return rows.map(toApiProjectEntity);
  } catch (e) {
    return handleError(e, 'Failed to retrieve entity projects');
  }
};

export const getEntityDiagramFiles = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<DiagramEntityFile[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  await buildApiAuthCtx(db, ws, event);
  try {
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const rows = await db.project.getEntityDiagramFiles(ws, entity.id);
    return rows.map(row => ({
      file: {
        id: row.file_id,
        project_id: row.project_id,
        path: row.file_path,
        name: row.file_name,
        size_bytes: row.file_size_bytes,
        comment_count: row.file_comment_count,
        unresolved_comment_count: row.file_unresolved_comment_count,
        type: row.file_type,
        preview_svg: row.file_preview_svg,
        created_at: row.file_created_at.toISOString(),
        updated_at: row.file_updated_at.toISOString(),
        content_metadata:
          row.file_metadata_title !== null ||
          row.file_metadata_description !== null ||
          row.file_metadata_company !== null ||
          row.file_metadata_category !== null ||
          row.file_metadata_keywords.length > 0
            ? {
                title: row.file_metadata_title,
                description: row.file_metadata_description,
                company: row.file_metadata_company,
                category: row.file_metadata_category,
                keywords: row.file_metadata_keywords
              }
            : null
      },
      project: {
        id: row.project_id,
        public_id: row.project_public_id,
        name: row.project_name
      }
    }));
  } catch (e) {
    return handleError(e, 'Failed to retrieve entity diagram files');
  }
};
