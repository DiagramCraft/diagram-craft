import { createHomeWorkspaceRoute } from './homeWorkspaceRoute';
import { createProjectWorkspaceRoutes } from './projectWorkspaceRoutes';
import { createEntityWorkspaceRoutes } from './entityWorkspaceRoutes';
import { createDataModelWorkspaceRoute } from './dataModelWorkspaceRoute';
import { createSearchWorkspaceRoute } from './searchWorkspaceRoute';
import { createSettingsWorkspaceRoutes } from './settingsWorkspaceRoutes';
import { createAssistantWorkspaceRoutes } from './assistantWorkspaceRoutes';

export const createWorkspaceRouteEntries = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => [
  ...createHomeWorkspaceRoute(workspaceRoute),
  ...createProjectWorkspaceRoutes(workspaceRoute),
  ...createEntityWorkspaceRoutes(workspaceRoute),
  ...createDataModelWorkspaceRoute(workspaceRoute),
  ...createSearchWorkspaceRoute(workspaceRoute),
  ...createSettingsWorkspaceRoutes(workspaceRoute),
  ...createAssistantWorkspaceRoutes(workspaceRoute)
];
