import type { AppRailItemId } from './appShellRegistry';

export type BreadcrumbItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

export type WorkspaceRailItemId =
  | 'home'
  | 'content'
  | 'projects'
  | 'entities'
  | AppRailItemId
  | 'search'
  | 'governance'
  | 'assistant'
  | 'extract';

/** Application identifier: `'home'` is the always-on core register; the rest are opt-in apps. */
export type AppId = 'home' | AppRailItemId;

/**
 * A workspace application — the layer above the left rail. Selecting an app in the switcher
 * scopes the rail to `railItems` and re-skins the shell with `tint`. `'home'` carries no
 * `shortCode`/`tint` and is always enabled; other apps are enabled iff their backing workspace
 * capability has a valid configuration.
 */
export type AppDefinition = {
  id: AppId;
  name: string;
  /** Short badge code shown in the switcher; omitted for `'home'` (renders a Home icon instead). */
  shortCode?: string;
  /** oklch accent applied to the shell while the app is active; omitted for `'home'`. */
  tint?: string;
  description: string;
  railItems: WorkspaceRailItemId[];
  rootRoute: string;
  enablement: 'always' | { capabilityType: string };
};
