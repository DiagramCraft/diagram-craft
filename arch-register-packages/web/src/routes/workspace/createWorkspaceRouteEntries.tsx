import type { AnyRoute } from '@tanstack/react-router';
import { createHomeWorkspaceRoute } from './homeWorkspaceRoute';
import { createContentWorkspaceRoutes } from './contentWorkspaceRoutes';
import { createProjectWorkspaceRoutes } from './projectWorkspaceRoutes';
import { createEntityWorkspaceRoutes } from './entityWorkspaceRoutes';
import { createSearchWorkspaceRoute } from './searchWorkspaceRoute';
import { createSettingsWorkspaceRoutes } from './settingsWorkspaceRoutes';
import { createAssistantWorkspaceRoutes } from './assistantWorkspaceRoutes';

export const createWorkspaceRouteEntries = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) =>
  [
    ...createHomeWorkspaceRoute(workspaceRoute),
    ...createContentWorkspaceRoutes(workspaceRoute),
    ...createProjectWorkspaceRoutes(workspaceRoute),
    ...createEntityWorkspaceRoutes(workspaceRoute),
    ...createSearchWorkspaceRoute(workspaceRoute),
    ...createSettingsWorkspaceRoutes(workspaceRoute),
    ...createAssistantWorkspaceRoutes(workspaceRoute)
  ] as const;
