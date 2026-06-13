import { createHomeWorkspaceRoute } from './homeWorkspaceRoute';
import { createContentWorkspaceRoutes } from './contentWorkspaceRoutes';
import { createProjectWorkspaceRoutes } from './projectWorkspaceRoutes';
import { createEntityWorkspaceRoutes } from './entityWorkspaceRoutes';
import { createSearchWorkspaceRoute } from './searchWorkspaceRoute';
import { createSettingsWorkspaceRoutes } from './settingsWorkspaceRoutes';
import { createAssistantWorkspaceRoutes } from './assistantWorkspaceRoutes';

export const createWorkspaceRouteEntries = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => [
  ...createHomeWorkspaceRoute(workspaceRoute),
  ...createContentWorkspaceRoutes(workspaceRoute),
  ...createProjectWorkspaceRoutes(workspaceRoute),
  ...createEntityWorkspaceRoutes(workspaceRoute),
  ...createSearchWorkspaceRoute(workspaceRoute),
  ...createSettingsWorkspaceRoutes(workspaceRoute),
  ...createAssistantWorkspaceRoutes(workspaceRoute)
];
