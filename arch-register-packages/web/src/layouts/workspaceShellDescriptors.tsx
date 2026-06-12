import { TbCode, TbDatabase, TbFolders, TbHome, TbSearch, TbSettings } from 'react-icons/tb';
import { HomeSidebar } from '../sections/home/HomeSidebar';
import { ProjectsSidebar } from '../sections/projects/ProjectsSidebar';
import { EntitiesSidebar } from '../sections/entities/EntitiesSidebar';
import { EntityContentSidebar } from '../sections/entities/EntityContentSidebar';
import { DataModelSidebar } from '../sections/data-model/DataModelSidebar';
import { WorkspaceSettingsSidebar } from '../sections/workspace-settings/WorkspaceSettingsSidebar';
import { GlobalSettingsSidebar } from '../sections/global-settings/GlobalSettingsSidebar';
import { AccountSettingsSidebar } from '../sections/account-settings/AccountSettingsSidebar';
import type { BreadcrumbItem, WorkspaceRailItemId } from '../shell/shellTypes';
import type { Workspace } from '@arch-register/api-types/workspaceContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Project } from '@arch-register/api-types/projectContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '../lib/api';

type MatchLike = {
  routeId: string;
  params: Record<string, string>;
};

type WorkspaceRouteKind =
  | 'home'
  | 'project-detail'
  | 'diagram'
  | 'entity-browser'
  | 'entity-detail'
  | 'entity-diagram'
  | 'data-model'
  | 'search'
  | 'workspace-settings'
  | 'global-settings'
  | 'account-settings'
  | 'assistant'
  | 'extract'
  | 'import';

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

const getDefaultProject = (projects: Project[]): Project | undefined =>
  projects.find(project => project.status !== 'complete' && project.status !== 'cancelled') ??
  projects[0];

const getProjectSidebarTab = (project: Project | undefined): 'projects' | 'archive' =>
  project?.status === 'complete' || project?.status === 'cancelled' ? 'archive' : 'projects';

const getAllParams = (matches: MatchLike[]) =>
  Object.assign({}, ...matches.map(match => match.params)) as Record<string, string>;

const buildHomeBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => [
  {
    label: 'Home',
    icon: <TbHome size={12} />,
    onClick: () => ctx.navigate({ to: '/$workspaceSlug', params: { workspaceSlug: ctx.workspaceSlug } })
  }
];

const buildProjectBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => {
  const params = getAllParams(ctx.matches);
  const project = ctx.projects.find(item => item.id === params.projectId);

  return [
    ...buildHomeBreadcrumbs(ctx),
    {
      label: 'Projects',
      icon: <TbFolders size={12} />,
      onClick: () => {
        const defaultProject = getDefaultProject(ctx.projects);
        if (!defaultProject) return;
        ctx.navigate({
          to: '/$workspaceSlug/projects/$projectId',
          params: { workspaceSlug: ctx.workspaceSlug, projectId: defaultProject.id },
          search: { tab: getProjectSidebarTab(defaultProject) }
        });
      }
    },
    ...(project ? [{ label: project.name, onClick: () => {} }] : [])
  ];
};

const buildEntityBreadcrumbs = (ctx: WorkspaceShellContext, detail: boolean): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label: 'Entities',
    icon: <TbDatabase size={12} />,
    onClick: () => ctx.navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug: ctx.workspaceSlug } })
  },
  ...(detail ? [{ label: 'Detail', onClick: () => {} }] : [])
];

const buildModelBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label: 'Data model',
    icon: <TbCode size={12} />,
    onClick: () => ctx.navigate({ to: '/$workspaceSlug/model', params: { workspaceSlug: ctx.workspaceSlug } })
  }
];

const buildSearchBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label: 'Search',
    icon: <TbSearch size={12} />,
    onClick: () => ctx.navigate({ to: '/$workspaceSlug/search', params: { workspaceSlug: ctx.workspaceSlug } })
  }
];

const buildSettingsBreadcrumbs = (
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

type WorkspaceShellFactory = (ctx: WorkspaceShellContext) => WorkspaceShellDescriptor;

const resolveRouteKind = (routeId: string): WorkspaceRouteKind | null => {
  if (routeId.includes('/entities/$entityId/diagrams/$diagramId')) return 'entity-diagram';
  if (routeId.includes('/projects/$projectId/diagrams/$diagramId')) return 'diagram';
  if (routeId.includes('/entities/import')) return 'import';
  if (routeId.includes('/entities/$entityId')) return 'entity-detail';
  if (routeId.endsWith('/entities')) return 'entity-browser';
  if (routeId.includes('/projects/$projectId')) return 'project-detail';
  if (routeId.endsWith('/model')) return 'data-model';
  if (routeId.endsWith('/search')) return 'search';
  if (routeId.endsWith('/settings/global')) return 'global-settings';
  if (routeId.endsWith('/settings')) return 'workspace-settings';
  if (routeId.endsWith('/account')) return 'account-settings';
  if (routeId.endsWith('/assistant')) return 'assistant';
  if (routeId.endsWith('/extract')) return 'extract';
  if (routeId === '/authenticated/$workspaceSlug/' || routeId === '/authenticated/$workspaceSlug')
    return 'home';
  return null;
};

const shellFactories: Record<WorkspaceRouteKind, WorkspaceShellFactory> = {
  home: ctx => ({
    variant: 'standard',
    activeRailItem: 'home',
    breadcrumbs: buildHomeBreadcrumbs(ctx),
    primarySidebar: (
      <HomeSidebar
        schemas={ctx.schemas}
        projects={ctx.projects}
        workspaceSlug={ctx.workspaceSlug}
      />
    )
  }),
  'project-detail': ctx => ({
    variant: 'standard',
    activeRailItem: 'projects',
    breadcrumbs: buildProjectBreadcrumbs(ctx),
    primarySidebar: (
      <ProjectsSidebar projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />
    )
  }),
  'entity-browser': ctx => ({
    variant: 'standard',
    activeRailItem: 'entities',
    breadcrumbs: buildEntityBreadcrumbs(ctx, false),
    primarySidebar: (
      <EntitiesSidebar
        schemas={ctx.schemas}
        lifecycleStates={ctx.lifecycleStates}
        workspaceSlug={ctx.workspaceSlug}
      />
    )
  }),
  import: ctx => ({
    variant: 'standard',
    activeRailItem: 'entities',
    breadcrumbs: buildEntityBreadcrumbs(ctx, false),
    primarySidebar: (
      <EntitiesSidebar
        schemas={ctx.schemas}
        lifecycleStates={ctx.lifecycleStates}
        workspaceSlug={ctx.workspaceSlug}
      />
    )
  }),
  'entity-detail': ctx => {
    const params = getAllParams(ctx.matches);
    return {
      variant: 'detail',
      activeRailItem: 'entities',
      breadcrumbs: buildEntityBreadcrumbs(ctx, true),
      navigationLabel: 'Entities',
      renderNavigation: controls => (
        <EntitiesSidebar
          schemas={ctx.schemas}
          lifecycleStates={ctx.lifecycleStates}
          workspaceSlug={ctx.workspaceSlug}
          onCollapse={controls.collapse}
          onExpand={controls.expand}
        />
      ),
      secondarySidebar: params.entityId ? (
        <EntityContentSidebar workspaceSlug={ctx.workspaceSlug} entityId={params.entityId} />
      ) : undefined
    };
  },
  'data-model': ctx => ({
    variant: 'standard',
    activeRailItem: 'model',
    breadcrumbs: buildModelBreadcrumbs(ctx),
    primarySidebar: (
      <DataModelSidebar
        schemas={ctx.schemas}
        enums={ctx.enums}
        workspaceSlug={ctx.workspaceSlug}
      />
    )
  }),
  search: ctx => ({
    variant: 'full-bleed',
    activeRailItem: 'search',
    breadcrumbs: buildSearchBreadcrumbs(ctx)
  }),
  'workspace-settings': ctx => ({
    variant: 'standard',
    activeRailItem: null,
    breadcrumbs: buildSettingsBreadcrumbs(ctx, 'Settings', '/$workspaceSlug/settings'),
    primarySidebar: (
      <WorkspaceSettingsSidebar
        workspaceSlug={ctx.workspaceSlug}
        workspace={ctx.workspace}
        schemas={ctx.schemas}
        projects={ctx.projects}
        availableSections={ctx.availableSettingsSections}
      />
    )
  }),
  'global-settings': ctx => ({
    variant: 'standard',
    activeRailItem: null,
    breadcrumbs: buildSettingsBreadcrumbs(
      ctx,
      'Global Settings',
      '/$workspaceSlug/settings/global'
    ),
    primarySidebar: <GlobalSettingsSidebar />
  }),
  'account-settings': ctx => ({
    variant: 'standard',
    activeRailItem: null,
    breadcrumbs: buildSettingsBreadcrumbs(ctx, 'Account Settings', '/$workspaceSlug/account'),
    primarySidebar: <AccountSettingsSidebar />
  }),
  assistant: ctx => ({
    variant: 'full-bleed',
    activeRailItem: 'assistant',
    breadcrumbs: [
      ...buildHomeBreadcrumbs(ctx),
      { label: 'AI Assistant', onClick: () => ctx.navigate({ to: '/$workspaceSlug/assistant', params: { workspaceSlug: ctx.workspaceSlug } }) }
    ]
  }),
  extract: ctx => ({
    variant: 'full-bleed',
    activeRailItem: 'extract',
    breadcrumbs: [
      ...buildHomeBreadcrumbs(ctx),
      { label: 'AI Extract', onClick: () => ctx.navigate({ to: '/$workspaceSlug/extract', params: { workspaceSlug: ctx.workspaceSlug } }) }
    ]
  }),
  diagram: () => ({
    variant: 'overlay'
  }),
  'entity-diagram': () => ({
    variant: 'overlay'
  })
};

export const resolveWorkspaceShellDescriptor = (
  ctx: WorkspaceShellContext
): WorkspaceShellDescriptor => {
  const activeKind = [...ctx.matches]
    .reverse()
    .map(match => resolveRouteKind(match.routeId))
    .find(kind => kind !== null);

  if (activeKind === undefined || activeKind === null) {
    return {
      variant: 'standard',
      activeRailItem: 'home',
      breadcrumbs: buildHomeBreadcrumbs(ctx)
    };
  }
  return shellFactories[activeKind](ctx);
};

export const navigateFromRailItem = (
  id: WorkspaceRailItemId,
  ctx: Pick<WorkspaceShellContext, 'navigate' | 'workspaceSlug' | 'projects'>
) => {
  if (id === 'projects') {
    const defaultProject = getDefaultProject(ctx.projects);
    if (!defaultProject) return 'open-project-dialog' as const;
    ctx.navigate({
      to: '/$workspaceSlug/projects/$projectId',
      params: { workspaceSlug: ctx.workspaceSlug, projectId: defaultProject.id },
      search: { tab: getProjectSidebarTab(defaultProject) }
    });
    return 'navigated' as const;
  }

  const routeByRail: Record<WorkspaceRailItemId, string> = {
    home: '/$workspaceSlug',
    projects: '/$workspaceSlug/projects/$projectId',
    entities: '/$workspaceSlug/entities',
    model: '/$workspaceSlug/model',
    search: '/$workspaceSlug/search',
    assistant: '/$workspaceSlug/assistant',
    extract: '/$workspaceSlug/extract'
  };

  ctx.navigate({
    to: routeByRail[id],
    params: { workspaceSlug: ctx.workspaceSlug }
  });
  return 'navigated' as const;
};
