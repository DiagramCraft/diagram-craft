export const workspaceHomeRoute = (workspaceSlug: string) => `/${workspaceSlug}`;

export const workspaceProjectsRoute = (workspaceSlug: string) => `/${workspaceSlug}/projects`;

export const workspaceEntitiesRoute = (workspaceSlug: string) => `/${workspaceSlug}/entities`;

export const workspaceModelRoute = (workspaceSlug: string) => `/${workspaceSlug}/model`;

export const workspaceSearchRoute = (workspaceSlug: string) => `/${workspaceSlug}/search`;

export const workspaceSettingsRoute = (workspaceSlug: string) => `/${workspaceSlug}/settings`;

export const accountSettingsRoute = (workspaceSlug: string, section?: 'profile' | 'appearance') =>
  section == null ? `/${workspaceSlug}/account` : `/${workspaceSlug}/account?section=${section}`;
