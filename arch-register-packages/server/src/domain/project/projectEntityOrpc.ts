import {
  addProjectEntity,
  getEntityDiagramFiles,
  getEntityProjects,
  listProjectEntities,
  removeProjectEntity,
  updateProjectEntity
} from './projectEntityOperations';
import { projectRouter } from './projectRouter';

export const projectEntityHandlers = {
  listEntities: projectRouter.projects.listEntities.handler(async ({ input, context }) => {
    return await listProjectEntities(
      context.db,
      input.params.workspace,
      input.params.id,
      context.event
    );
  }),
  listEntityProjects: projectRouter.projects.listEntityProjects.handler(
    async ({ input, context }) => {
      return await getEntityProjects(
        context.db,
        input.params.workspace,
        input.params.entityId,
        context.event
      );
    }
  ),
  addEntity: projectRouter.projects.addEntity.handler(async ({ input, context }) => {
    return await addProjectEntity(
      context.db,
      input.params.workspace,
      input.params.id,
      input.body,
      context.event
    );
  }),
  updateEntity: projectRouter.projects.updateEntity.handler(async ({ input, context }) => {
    return await updateProjectEntity(
      context.db,
      input.params.workspace,
      input.params.id,
      input.params.entityId,
      input.body,
      context.event
    );
  }),
  removeEntity: projectRouter.projects.removeEntity.handler(async ({ input, context }) => {
    return await removeProjectEntity(
      context.db,
      input.params.workspace,
      input.params.id,
      input.params.entityId,
      context.event
    );
  }),
  getEntityDiagramFiles: projectRouter.projects.getEntityDiagramFiles.handler(
    async ({ input, context }) => {
      return await getEntityDiagramFiles(
        context.db,
        input.params.workspace,
        input.params.entityId,
        context.event
      );
    }
  )
};
