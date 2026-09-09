import type { IconType } from 'react-icons';
import type { WorkspaceApplicationId } from '@arch-register/api-types/workspaceConfigContract';
import type { AppRailItemId } from './appShellRegistry';

export type BreadcrumbItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

/** Rail items owned by the always-on Home app (the core register). */
export type WorkspaceCoreRailItemId =
  | 'home'
  | 'content'
  | 'projects'
  | 'entities'
  | 'search'
  | 'governance'
  | 'assistant'
  | 'extract';

export type WorkspaceRailItemId = WorkspaceCoreRailItemId | AppRailItemId;

/** Application identifier: `'home'` is the always-on core register; the rest are opt-in apps. */
export type AppId = 'home' | AppRailItemId;

/** Context passed to a section's `primarySidebar` factory (a structural subset of the shell context). */
export type AppRailSectionContext = {
  workspaceSlug: string;
};

/**
 * One left-rail section owned by an application: its rail-item id, icon and tooltip, the route
 * the rail item navigates to, and an optional primary sidebar rendered while the section is active.
 * An app may own several sections (e.g. a capability-modelling app with map / list / heatmap views).
 */
export type AppRailSection = {
  id: WorkspaceRailItemId;
  icon: IconType;
  tooltip: string;
  route: string;
  /** Renders a rail divider before this item. */
  separator?: boolean;
  /** Primary sidebar shown while this section is active; resolved by the section's route. */
  primarySidebar?: (ctx: AppRailSectionContext) => React.ReactNode;
};

/**
 * A workspace application — the layer above the left rail. Selecting an app in the switcher
 * scopes the rail to `sections` and re-skins the shell with `tint`. `'home'` carries no
 * `shortCode`/`tint` and is always enabled; other apps are enabled iff their backing workspace
 * capability has a valid configuration.
 */
export type AppDefinition = {
  id: AppId;
  /** Stable application identity used by the server-side access policy. */
  applicationId: WorkspaceApplicationId;
  name: string;
  /** Short badge code shown in the switcher; omitted for `'home'` (renders a Home icon instead). */
  shortCode?: string;
  /** oklch accent applied to the shell while the app is active; omitted for `'home'`. */
  tint?: string;
  description: string;
  sections: AppRailSection[];
  enablement: 'always' | { capabilityType: string };
};
