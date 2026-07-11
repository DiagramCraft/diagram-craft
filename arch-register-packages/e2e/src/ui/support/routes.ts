export const workspaceHomeRoute = (workspaceSlug: string) => `/${workspaceSlug}`;

export const workspaceProjectsRoute = (workspaceSlug: string) => `/${workspaceSlug}/projects`;

export const projectDetailRoute = (
  workspaceSlug: string,
  projectId: string,
  tab: 'projects' | 'archive' = 'projects',
  section: 'home' | 'entities' = 'home'
) => `/${workspaceSlug}/projects/${projectId}?tab=${tab}&section=${section}`;

export const workspaceEntitiesRoute = (workspaceSlug: string) => `/${workspaceSlug}/entities`;

export const workspaceModelRoute = (workspaceSlug: string) => `/${workspaceSlug}/settings/schemas`;

export const workspaceModelOverviewRoute = (workspaceSlug: string) =>
  `/${workspaceSlug}/settings/model-overview`;

export const workspaceSearchRoute = (workspaceSlug: string) => `/${workspaceSlug}/search`;

export const workspaceSettingsRoute = (workspaceSlug: string, section?: string) =>
  section == null ? `/${workspaceSlug}/settings` : `/${workspaceSlug}/settings/${section}`;

export const accountSettingsRoute = (workspaceSlug: string, section?: 'profile' | 'appearance') =>
  section == null ? `/${workspaceSlug}/account` : `/${workspaceSlug}/account/${section}`;
