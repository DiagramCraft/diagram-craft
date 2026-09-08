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
import {
  glossaryAppDefinition,
  type GlossaryRailItemId
} from '../app/business-glossary/glossaryShell';
import { strategyAppDefinition } from '../app/strategy-model/strategyShell';
import type { StrategyRailItemId } from '../app/strategy-model/strategySections';
import type { AppDefinition, AppId, AppRailSection, WorkspaceRailItemId } from './shellTypes';

/**
 * The workspace application registry. Each app owns a set of left-rail sections; the switcher in
 * the top bar scopes the rail to the active app and re-skins the shell with its accent. `'home'` is
 * the always-on core register; other apps are enabled iff their backing workspace capability has a
 * valid configuration.
 *
 * Add a new app by appending its `AppDefinition` here (define it next to the app's code and import
 * it, as `glossaryAppDefinition` does) — core shell files must not hardcode individual app ids.
 * Every rail-item id, icon, tooltip and route is derived from the apps' `sections`.
 */
export type AppRailItemId = GlossaryRailItemId | StrategyRailItemId;

export const HOME_APP: AppDefinition = {
  id: 'home',
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
  ],
  enablement: 'always'
};

export const APP_DEFINITIONS: AppDefinition[] = [
  HOME_APP,
  glossaryAppDefinition,
  strategyAppDefinition
];

export const getAppDefinition = (id: AppId): AppDefinition =>
  APP_DEFINITIONS.find(app => app.id === id) ?? HOME_APP;

/** The route an app opens to when picked in the switcher (its first section). */
export const appRootRoute = (app: AppDefinition): string => app.sections[0]!.route;

const ALL_SECTIONS: ReadonlyArray<{ app: AppDefinition; section: AppRailSection }> =
  APP_DEFINITIONS.flatMap(app => app.sections.map(section => ({ app, section })));

const RAIL_ITEM_TO_APP = new Map<WorkspaceRailItemId, AppId>(
  ALL_SECTIONS.map(({ app, section }) => [section.id, app.id] as const)
);

/** Which app owns a rail item; falls back to `'home'` (also used for the chrome-less overlay). */
export const railItemToAppId = (railItemId: WorkspaceRailItemId | null): AppId =>
  (railItemId != null ? RAIL_ITEM_TO_APP.get(railItemId) : undefined) ?? 'home';

const RAIL_SECTIONS = new Map<WorkspaceRailItemId, AppRailSection>(
  ALL_SECTIONS.map(({ section }) => [section.id, section] as const)
);

/** The rail section for a rail-item id, across every registered app. */
export const getRailSection = (id: WorkspaceRailItemId): AppRailSection | undefined =>
  RAIL_SECTIONS.get(id);

/** Icon / tooltip / separator metadata for a rail item, derived from the owning app's section. */
export const railItemMeta = (
  id: WorkspaceRailItemId
): Pick<AppRailSection, 'icon' | 'tooltip' | 'separator'> => {
  const section = RAIL_SECTIONS.get(id);
  if (!section) throw new Error(`No registered rail section for id "${id}"`);
  return { icon: section.icon, tooltip: section.tooltip, separator: section.separator };
};

/** Rail item id → route, for every section of every app (home included). */
export const RAIL_ROUTES: Record<WorkspaceRailItemId, string> = Object.fromEntries(
  ALL_SECTIONS.map(({ section }) => [section.id, section.route])
) as Record<WorkspaceRailItemId, string>;

/**
 * Rail item id → route for non-home apps. Consumed by `../layouts/workspaceShellDescriptors.tsx`
 * so it doesn't hardcode individual app ids.
 */
export const APP_RAIL_ROUTES: Record<AppRailItemId, string> = Object.fromEntries(
  ALL_SECTIONS.filter(({ app }) => app.id !== 'home').map(({ section }) => [
    section.id,
    section.route
  ])
) as Record<AppRailItemId, string>;

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
