import type { AnyRoute } from '@tanstack/react-router';
import { createHomeWorkspaceRoute } from './homeWorkspaceRoute';
import { createContentWorkspaceRoutes } from './contentWorkspaceRoutes';
import { createProjectWorkspaceRoutes } from './projectWorkspaceRoutes';
import { createEntityWorkspaceRoutes } from './entityWorkspaceRoutes';
import { createSearchWorkspaceRoute } from './searchWorkspaceRoute';
import { createSettingsWorkspaceRoutes } from './settingsWorkspaceRoutes';
import { createAssistantWorkspaceRoutes } from './assistantWorkspaceRoutes';
import { createGovernanceWorkspaceRoute } from './governanceWorkspaceRoute';
import { createGlossaryWorkspaceRoutes } from '../../app/business-glossary/glossaryWorkspaceRoute';

export const createWorkspaceRouteEntries = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) =>
  [
    ...createHomeWorkspaceRoute(workspaceRoute),
    ...createContentWorkspaceRoutes(workspaceRoute),
    ...createProjectWorkspaceRoutes(workspaceRoute),
    ...createEntityWorkspaceRoutes(workspaceRoute),
    ...createGlossaryWorkspaceRoutes(workspaceRoute),
    ...createSearchWorkspaceRoute(workspaceRoute),
    ...createGovernanceWorkspaceRoute(workspaceRoute),
    ...createSettingsWorkspaceRoutes(workspaceRoute),
    ...createAssistantWorkspaceRoutes(workspaceRoute)
  ] as const;
