import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject
} from './projectCrudOperations';
import { projectRouter } from './projectRouter';

export const projectCrudHandlers = {
  list: projectRouter.projects.list.handler(async ({ input, context }) => {
    return await listProjects(context.db, input.params.workspace, context.event);
  }),
  get: projectRouter.projects.get.handler(async ({ input, context }) => {
    return await getProject(context.db, input.params.workspace, input.params.id, context.event);
  }),
  create: projectRouter.projects.create.handler(async ({ input, context }) => {
    return await createProject(context.db, input.params.workspace, input.body, context.event);
  }),
  update: projectRouter.projects.update.handler(async ({ input, context }) => {
    return await updateProject(
      context.db,
      input.params.workspace,
      input.params.id,
      input.body,
      context.event
    );
  }),
  remove: projectRouter.projects.remove.handler(async ({ input, context }) => {
    return await deleteProject(
      context.db,
      input.params.workspace,
      input.params.id,
      context.event,
      context.storage
    );
  })
};
