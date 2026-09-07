import { TbDatabase, TbFiles, TbFolders, TbSearch, TbSettings } from 'react-icons/tb';
import type { AppId, BreadcrumbItem, WorkspaceRailItemId } from '../shell/shellTypes';
import { buildHomeBreadcrumbs } from '../shell/breadcrumbBuilders';
import {
  appRootRoute,
  getAppDefinition,
  getRailSection,
  RAIL_ROUTES
} from '../shell/appShellRegistry';
import type { Workspace } from '@arch-register/api-types/workspaceContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';

type MatchLike = {
  routeId: string;
  params: Record<string, string>;
  buildShell?: (ctx: WorkspaceShellContext) => WorkspaceShellDescriptor;
};

type NavigateLike = (args: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
}) => void;

export type WorkspaceShellContext = {
  matches: MatchLike[];
  navigate: NavigateLike;
  workspace: Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  enums: WorkspaceEnum[];
  projects: Project[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  availableSettingsSections: string[];
};

export type WorkspaceShellDescriptor =
  | {
      variant: 'overlay';
    }
  | {
      variant: 'standard' | 'full-bleed';
      activeRailItem: WorkspaceRailItemId | null;
      breadcrumbs: BreadcrumbItem[];
      primarySidebar?: React.ReactNode;
      hideSearch?: boolean;
      hideWorkspaceSwitcher?: boolean;
    }
  | {
      variant: 'detail';
      activeRailItem: WorkspaceRailItemId | null;
      breadcrumbs: BreadcrumbItem[];
      navigationLabel: string;
      renderNavigation: (controls: {
        expanded: boolean;
        expand: () => void;
        collapse: () => void;
      }) => React.ReactNode;
      secondarySidebar?: React.ReactNode;
      hideSearch?: boolean;
      hideWorkspaceSwitcher?: boolean;
    };

export const getDefaultProject = (projects: Project[]): Project | undefined =>
  projects.find(project => project.status !== 'complete' && project.status !== 'cancelled') ??
  projects[0];

export const getProjectSidebarTab = (project: Project | undefined): 'projects' | 'archive' =>
  project?.status === 'complete' || project?.status === 'cancelled' ? 'archive' : 'projects';

export const getAllParams = (matches: MatchLike[]) =>
  Object.assign({}, ...matches.map(match => match.params)) as Record<string, string>;

export const buildProjectBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => {
  const params = getAllParams(ctx.matches);
  const project = ctx.projects.find(item => item.id === params.projectId);

  return [
    ...buildHomeBreadcrumbs(ctx),
    {
      label: 'Projects',
      icon: <TbFolders size={12} />,
      onClick: () =>
        ctx.navigate({
          to: '/$workspaceSlug/projects',
          params: { workspaceSlug: ctx.workspaceSlug }
        })
    },
    ...(project ? [{ label: project.name, onClick: () => {} }] : [])
  ];
};

export const buildEntityBreadcrumbs = (
  ctx: WorkspaceShellContext,
  detail: boolean
): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label: 'Entities',
    icon: <TbDatabase size={12} />,
    onClick: () =>
      ctx.navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug: ctx.workspaceSlug } })
  },
  ...(detail ? [{ label: 'Detail', onClick: () => {} }] : [])
];

export const buildWorkspaceContentBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label: 'Content',
    icon: <TbFiles size={12} />,
    onClick: () =>
      ctx.navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug: ctx.workspaceSlug } })
  }
];

export const buildSearchBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label: 'Search',
    icon: <TbSearch size={12} />,
    onClick: () =>
      ctx.navigate({ to: '/$workspaceSlug/search', params: { workspaceSlug: ctx.workspaceSlug } })
  }
];

export const buildSettingsBreadcrumbs = (
  ctx: WorkspaceShellContext,
  label: string,
  to: string
): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label,
    icon: <TbSettings size={12} />,
    onClick: () => ctx.navigate({ to, params: { workspaceSlug: ctx.workspaceSlug } })
  }
];

export const resolveWorkspaceShellDescriptor = (
  ctx: WorkspaceShellContext
): WorkspaceShellDescriptor => {
  const activeMatch = [...ctx.matches].reverse().find(match => match.buildShell !== undefined);

  if (!activeMatch?.buildShell) {
    return {
      variant: 'standard',
      activeRailItem: 'home',
      breadcrumbs: buildHomeBreadcrumbs(ctx)
    };
  }
  return activeMatch.buildShell(ctx);
};

export const navigateFromRailItem = (
  id: WorkspaceRailItemId,
  ctx: Pick<WorkspaceShellContext, 'navigate' | 'workspaceSlug' | 'projects'>
) => {
  ctx.navigate({
    to: RAIL_ROUTES[id],
    params: { workspaceSlug: ctx.workspaceSlug }
  });
  return 'navigated' as const;
};

/** Navigate to another application, landing on its first rail section. */
export const navigateToApp = (
  appId: AppId,
  ctx: Pick<WorkspaceShellContext, 'navigate' | 'workspaceSlug'>
) => {
  ctx.navigate({
    to: appRootRoute(getAppDefinition(appId)),
    params: { workspaceSlug: ctx.workspaceSlug }
  });
  return 'navigated' as const;
};

/**
 * Build a `standard` shell descriptor for an app rail section, pulling the section's declared
 * `primarySidebar` from the registry. Routes pass `overrides` (breadcrumbs, a different sidebar,
 * `variant`, …); anything omitted falls back to the section definition.
 */
export const railSectionShell = (
  ctx: WorkspaceShellContext,
  id: WorkspaceRailItemId,
  overrides: Partial<Extract<WorkspaceShellDescriptor, { variant: 'standard' | 'full-bleed' }>> & {
    breadcrumbs: BreadcrumbItem[];
  }
): WorkspaceShellDescriptor => ({
  variant: 'standard',
  activeRailItem: id,
  primarySidebar: getRailSection(id)?.primarySidebar?.(ctx),
  ...overrides
});
