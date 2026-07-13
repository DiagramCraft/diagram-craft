import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineOperation } from '../operation';
import {
  canAccessProject,
  requireEntityAction,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization';
import { projectDbErrorMessages } from './projectOperationHelpers';
import { httpAssert } from '../../utils/httpAssert';
import { toApiProject, toApiProjectEntity } from './projectHelpers';
import type {
  DiagramEntityFile,
  EntityProject,
  ProjectEntity
} from '@arch-register/api-types/projectContract';

export const listProjectEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<ProjectEntity[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve project entities',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, projectId);
      httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
      requireProjectAccess(authCtx, project.owner);
      const rows = await db.project.listProjectEntities(ws, project.id);
      return rows.map(toApiProjectEntity);
    }
  );
};

export const addProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  input: { entity_id: string; entity_type?: string | null; is_done?: boolean },
  event: AuthenticatedEvent
): Promise<ProjectEntity> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to add entity to project',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
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
    }
  );
};

export const updateProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  entityId: string,
  input: { entity_type?: string | null; is_done?: boolean },
  event: AuthenticatedEvent
): Promise<ProjectEntity> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update project entity',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
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
      httpAssert.present(row, {
        status: 404,
        message: `Entity '${entityId}' not found in project`
      });
      return toApiProjectEntity(row);
    }
  );
};

export const removeProjectEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to remove entity from project',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
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
    }
  );
};

export const getEntityProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<EntityProject[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve entity projects',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );
      const rows = await db.project.getEntityProjects(ws, entity.id);
      return rows
        .filter(row => canAccessProject(authCtx, row.project.owner))
        .map(row => ({
          project: toApiProject(row.project, row.file_count, authCtx),
          entity_type: row.entity_type_id
            ? { id: row.entity_type_id, name: row.entity_type_label ?? row.entity_type_id }
            : null
        }));
    }
  );
};

export const getEntityDiagramFiles = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<DiagramEntityFile[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve entity diagram files',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws }) => {
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
    }
  );
};
