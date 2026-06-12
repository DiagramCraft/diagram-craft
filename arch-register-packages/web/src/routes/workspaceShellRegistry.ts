import type { WorkspaceShellContext, WorkspaceShellDescriptor } from '../layouts/workspaceShellDescriptors';

export type WorkspaceShellEntry = {
  route: unknown;
  matchesRouteId: (routeId: string) => boolean;
  buildShell: (ctx: WorkspaceShellContext) => WorkspaceShellDescriptor;
};

let workspaceShellEntries: WorkspaceShellEntry[] = [];

export const setWorkspaceShellEntries = (entries: WorkspaceShellEntry[]) => {
  workspaceShellEntries = entries;
};

export const getWorkspaceShellEntries = () => workspaceShellEntries;
