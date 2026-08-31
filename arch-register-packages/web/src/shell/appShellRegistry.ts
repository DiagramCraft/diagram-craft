import type { CSSProperties } from 'react';
import {
  GLOSSARY_RAIL_ITEM_ID,
  glossaryAppDefinition
} from '../app/business-glossary/glossaryShell';
import type { AppDefinition, AppId, WorkspaceRailItemId } from './shellTypes';

/**
 * The workspace application registry. Each app owns a set of left-rail items; the switcher in the
 * top bar scopes the rail to the active app and re-skins the shell with its accent. `'home'` is
 * the always-on core register; other apps are enabled iff their backing workspace capability has a
 * valid configuration.
 *
 * Add a new app by appending its `AppDefinition` here (define it next to the app's code and import
 * it, as `glossaryAppDefinition` does) — core shell files must not hardcode individual app ids.
 */
export type AppRailItemId = typeof GLOSSARY_RAIL_ITEM_ID;

export const HOME_APP: AppDefinition = {
  id: 'home',
  name: 'Home',
  description: 'The register — entities, projects, model, and governance.',
  railItems: [
    'home',
    'content',
    'projects',
    'entities',
    'search',
    'governance',
    'assistant',
    'extract'
  ],
  rootRoute: '/$workspaceSlug',
  enablement: 'always'
};

export const APP_DEFINITIONS: AppDefinition[] = [HOME_APP, glossaryAppDefinition];

export const getAppDefinition = (id: AppId): AppDefinition =>
  APP_DEFINITIONS.find(app => app.id === id) ?? HOME_APP;

const RAIL_ITEM_TO_APP = new Map<WorkspaceRailItemId, AppId>(
  APP_DEFINITIONS.flatMap(app => app.railItems.map(item => [item, app.id] as const))
);

/** Which app owns a rail item; falls back to `'home'` (also used for the chrome-less overlay). */
export const railItemToAppId = (railItemId: WorkspaceRailItemId | null): AppId =>
  (railItemId != null ? RAIL_ITEM_TO_APP.get(railItemId) : undefined) ?? 'home';

/**
 * Rail item id → route for non-home apps. Consumed by `../layouts/workspaceShellDescriptors.tsx`
 * so it doesn't hardcode individual app ids.
 */
export const APP_RAIL_ROUTES: Record<AppRailItemId, string> = Object.fromEntries(
  APP_DEFINITIONS.filter(app => app.id !== 'home').map(app => [app.id, app.rootRoute])
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
