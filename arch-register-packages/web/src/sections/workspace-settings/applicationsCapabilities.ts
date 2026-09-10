import { APP_DEFINITIONS } from '../../shell/appShellRegistry';
import { getWorkspaceCapabilityDefinition } from '@arch-register/api-types/integrationCatalog';

/**
 * Shared model for the "Applications & Capabilities" settings screen and its secondary sidebar.
 * An application entry folds its backing capability binding together with its access policy; a
 * capability entry is binding-only.
 */

export type ApplicationsCapabilitiesPermissions = {
  /** `canManageWorkspaces` — may edit schema bindings / view config. */
  canManageBindings: boolean;
  /** `canAdministerWorkspace` — may edit the per-application access policy. */
  canManageAccess: boolean;
};

export type ACTab = { id: string; label: string };

export type ACItem = {
  id: string;
  label: string;
  kind: 'application' | 'capability';
  capabilityType: string;
  applicationId?: string;
  tabs: ACTab[];
};

const CAPABILITY_ONLY_TYPES = ['api-specification', 'retention'] as const;

const bindingTabsFor = (capabilityType: string): ACTab[] =>
  capabilityType === 'strategy-model'
    ? [
        { id: 'bindings', label: 'Bindings' },
        { id: 'fields', label: 'Fields' },
        { id: 'dashboard', label: 'Dashboard' }
      ]
    : [{ id: 'bindings', label: 'Binding' }];

export const buildApplicationsCapabilitiesItems = (
  perms: ApplicationsCapabilitiesPermissions
): { applications: ACItem[]; capabilities: ACItem[] } => {
  const applications: ACItem[] = APP_DEFINITIONS.filter(
    app => app.applicationId !== 'home' && app.enablement !== 'always'
  ).map(app => {
    const capabilityType = (app.enablement as { capabilityType: string }).capabilityType;
    return {
      id: app.applicationId,
      label: app.name,
      kind: 'application' as const,
      capabilityType,
      applicationId: app.applicationId,
      tabs: [
        ...(perms.canManageBindings ? bindingTabsFor(capabilityType) : []),
        ...(perms.canManageAccess ? [{ id: 'access', label: 'Access' }] : [])
      ]
    };
  });

  const capabilities: ACItem[] = perms.canManageBindings
    ? CAPABILITY_ONLY_TYPES.map(type => ({
        id: type,
        label: getWorkspaceCapabilityDefinition(type)?.label ?? type,
        kind: 'capability' as const,
        capabilityType: type,
        tabs: bindingTabsFor(type)
      }))
    : [];

  return { applications, capabilities };
};

export const allApplicationsCapabilitiesItems = (
  perms: ApplicationsCapabilitiesPermissions
): ACItem[] => {
  const { applications, capabilities } = buildApplicationsCapabilitiesItems(perms);
  return [...applications, ...capabilities];
};

/** Resolve the selected sidebar entry, falling back to the first available one. */
export const findApplicationsCapabilitiesItem = (
  perms: ApplicationsCapabilitiesPermissions,
  itemId: string | undefined
): ACItem | undefined => {
  const all = allApplicationsCapabilitiesItems(perms);
  return all.find(item => item.id === itemId) ?? all[0];
};

/** Resolve the active tab for an item, falling back to its first tab. */
export const resolveApplicationsCapabilitiesTab = (item: ACItem, tabId: string | undefined): string =>
  item.tabs.find(tab => tab.id === tabId)?.id ?? item.tabs[0]?.id ?? 'bindings';
