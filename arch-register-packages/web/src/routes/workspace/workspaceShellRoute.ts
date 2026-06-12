import type {
  WorkspaceShellContext,
  WorkspaceShellDescriptor
} from '../../layouts/workspaceShellDescriptors';

const workspaceShellBuilderKey = Symbol('workspace-shell-builder');

export type WorkspaceShellBuilder = (
  ctx: WorkspaceShellContext
) => WorkspaceShellDescriptor;

type WorkspaceShellCarrier = {
  [workspaceShellBuilderKey]?: WorkspaceShellBuilder;
};

export const withWorkspaceShell = <TRoute extends object>(
  route: TRoute,
  buildShell: WorkspaceShellBuilder
): TRoute => {
  Object.defineProperty(route, workspaceShellBuilderKey, {
    value: buildShell,
    enumerable: false,
    configurable: false
  });

  return route;
};

export const getWorkspaceShellBuilder = (route: unknown): WorkspaceShellBuilder | undefined =>
  (route as WorkspaceShellCarrier | undefined)?.[workspaceShellBuilderKey];
