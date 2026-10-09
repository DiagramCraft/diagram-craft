import type { CSSProperties } from 'react';
import {
  TbBriefcase2,
  TbClipboardCheck,
  TbDatabase,
  TbFileAi,
  TbFiles,
  TbHome,
  TbMessageCircleStar,
  TbSearch
} from 'react-icons/tb';
import type { WorkspaceApplicationWithDashboards } from '@arch-register/api-types/applicationContract';
import { AppDashboardPrimarySidebar } from '../sections/dashboard/AppDashboardPrimarySidebar';
import { resolveAppIcon } from './appIcons';
import type { AppDefinition, AppId, AppRailSection, WorkspaceRailItemId } from './shellTypes';

/**
 * The workspace application registry. `HOME_APP` is the always-on core register and is defined in
 * code; every other app is a workspace application fetched from the server and turned into an
 * `AppDefinition` by `buildAppDefinitions`, one rail section per dashboard. Each app owns a set of
 * left-rail sections; the switcher in the top bar scopes the rail to the active app and re-skins
 * the shell with its accent.
 */
export const HOME_APP: AppDefinition = {
  id: 'home',
  applicationId: 'home',
  name: 'Home',
  description: 'The register — entities, projects, model, and governance.',
  sections: [
    { id: 'home', icon: TbHome, tooltip: 'Workspace overview', route: '/$workspaceSlug' },
    {
      id: 'content',
      icon: TbFiles,
      tooltip: 'Workspace content',
      route: '/$workspaceSlug/content'
    },
    { id: 'projects', icon: TbBriefcase2, tooltip: 'Projects', route: '/$workspaceSlug/projects' },
    { id: 'entities', icon: TbDatabase, tooltip: 'Entities', route: '/$workspaceSlug/entities' },
    { id: 'search', icon: TbSearch, tooltip: 'Search', route: '/$workspaceSlug/search' },
    {
      id: 'governance',
      icon: TbClipboardCheck,
      tooltip: 'My work',
      route: '/$workspaceSlug/governance'
    },
    {
      id: 'assistant',
      icon: TbMessageCircleStar,
      tooltip: 'AI Assistant',
      route: '/$workspaceSlug/assistant',
      separator: true
    },
    { id: 'extract', icon: TbFileAi, tooltip: 'AI Extract', route: '/$workspaceSlug/extract' }
  ]
};

export const APP_ROUTE = '/$workspaceSlug/apps/$appKey/$dashboardId';

/** Initials of the application name, used as the switcher badge (e.g. "Risk & Compliance" → "RC"). */
export const applicationShortCode = (name: string): string =>
  name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word !== '')
    .map(word => word[0]!.toUpperCase())
    .slice(0, 2)
    .join('');

const toAppDefinition = (application: WorkspaceApplicationWithDashboards): AppDefinition => ({
  id: application.key,
  applicationId: application.key,
  name: application.name,
  shortCode: applicationShortCode(application.name),
  tint: application.accentColor ?? undefined,
  description: application.description,
  sections: [...application.dashboards]
    .sort((a, b) => a.order - b.order)
    .map(dashboard => ({
      id: dashboard.id,
      icon: resolveAppIcon(dashboard.icon),
      tooltip: dashboard.railLabel ?? dashboard.name,
      route: APP_ROUTE,
      routeParams: { appKey: application.key, dashboardId: dashboard.id },
      primarySidebar: dashboard.sidebar
        ? ctx => (
            <AppDashboardPrimarySidebar
              workspaceSlug={ctx.workspaceSlug}
              dashboardId={dashboard.id}
            />
          )
        : undefined
    }))
});

/** `HOME_APP` followed by one app per workspace application, in display order. */
export const buildAppDefinitions = (
  applications: ReadonlyArray<WorkspaceApplicationWithDashboards> | undefined
): AppDefinition[] => [
  HOME_APP,
  ...(applications ?? [])
    .filter(application => application.dashboards.length > 0)
    .map(toAppDefinition)
];

export const getAppDefinition = (apps: AppDefinition[], id: AppId): AppDefinition =>
  apps.find(app => app.id === id) ?? HOME_APP;

/** The section an app opens to when picked in the switcher (its first one). */
export const appRootSection = (app: AppDefinition): AppRailSection => app.sections[0]!;

/** Which app owns a rail item; falls back to `'home'` (also used for the chrome-less overlay). */
export const railItemToAppId = (
  apps: AppDefinition[],
  railItemId: WorkspaceRailItemId | null
): AppId =>
  (railItemId != null
    ? apps.find(app => app.sections.some(section => section.id === railItemId))?.id
    : undefined) ?? 'home';

/** The rail section for a rail-item id, across every app. */
export const getRailSection = (
  apps: AppDefinition[],
  id: WorkspaceRailItemId
): AppRailSection | undefined =>
  apps.flatMap(app => app.sections).find(section => section.id === id);

/** CSS custom-property overrides that re-skin the shell accent while `app` is active. */
export const appAccentStyle = (app: AppDefinition): CSSProperties => {
  const tint = app.tint;
  if (!tint) return {};
  return {
    '--accent-chroma': tint,
    '--accent-border': `color-mix(in oklch, ${tint} 55%, transparent)`,
    '--accent-bg': `color-mix(in oklch, ${tint} 16%, transparent)`,
    '--accent-bg-selected': `color-mix(in oklch, ${tint} 26%, transparent)`,
    '--accent-fg': `color-mix(in oklch, ${tint} 72%, var(--base-fg))`,
    '--accent-fg-hover': tint
  } as CSSProperties;
};
