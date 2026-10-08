import { APP_DEFINITIONS } from '../../shell/appShellRegistry';

/**
 * Shared model for the "Applications & Capabilities" settings screen and its secondary sidebar.
 * Each entry is an application with its access-policy tab; applications backed by a capability with
 * non-dashboard consumers also get a binding tab.
 */

/** Applications whose capability binding is still read by non-dashboard code. */
const BOUND_CAPABILITY_BY_APPLICATION: Record<string, string> = {
  'business-glossary': 'business-glossary',
  'api-integration-catalog': 'api-specification'
};

export type ApplicationsCapabilitiesPermissions = {
  /** `canManageWorkspaces` — may edit schema bindings. */
  canManageBindings: boolean;
  /** `canAdministerWorkspace` — may edit the per-application access policy. */
  canManageAccess: boolean;
};

export type ACTab = { id: string; label: string };

export type ACItem = {
  id: string;
  label: string;
  applicationId: string;
  /** Capability whose binding the application edits; absent when it has none. */
  capabilityType?: string;
  tabs: ACTab[];
};

export const buildApplicationsCapabilitiesItems = (
  perms: ApplicationsCapabilitiesPermissions
): ACItem[] =>
  APP_DEFINITIONS.filter(app => app.applicationId !== 'home').map(app => {
    const capabilityType = BOUND_CAPABILITY_BY_APPLICATION[app.applicationId];
    return {
      id: app.applicationId,
      label: app.name,
      applicationId: app.applicationId,
      capabilityType,
      tabs: [
        ...(capabilityType && perms.canManageBindings
          ? [{ id: 'bindings', label: 'Binding' }]
          : []),
        ...(perms.canManageAccess ? [{ id: 'access', label: 'Access' }] : [])
      ]
    };
  });

/** Resolve the selected sidebar entry, falling back to the first available one. */
export const findApplicationsCapabilitiesItem = (
  perms: ApplicationsCapabilitiesPermissions,
  itemId: string | undefined
): ACItem | undefined => {
  const all = buildApplicationsCapabilitiesItems(perms);
  return all.find(item => item.id === itemId) ?? all[0];
};

/** Resolve the active tab for an item, falling back to its first tab. */
export const resolveApplicationsCapabilitiesTab = (
  item: ACItem,
  tabId: string | undefined
): string => item.tabs.find(tab => tab.id === tabId)?.id ?? item.tabs[0]?.id ?? 'access';
