import { orpcClient } from './orpcClient';

export const fetchEntityProjects = (workspace: string, entityId: string) =>
  orpcClient.projects.listEntityProjects({ params: { workspace, entityId } });
