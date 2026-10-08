import { getWorkspaceCapabilityDefinition } from '@arch-register/api-types/integrationCatalog';
import { APP_DEFINITIONS } from '../../shell/appShellRegistry';

/**
 * Shared model for the "Applications & Capabilities" settings screen and its secondary sidebar.
 * An application entry carries its access policy; a capability entry carries a schema binding that
 * non-dashboard code reads.
 */

/** Capabilities whose binding is read by non-dashboard code and so stays configurable. */
const CAPABILITY_TYPES = ['api-specification'] as const;

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
  kind: 'application' | 'capability';
  applicationId?: string;
  capabilityType?: string;
  tabs: ACTab[];
};

export const buildApplicationsCapabilitiesItems = (
  perms: ApplicationsCapabilitiesPermissions
): { applications: ACItem[]; capabilities: ACItem[] } => {
  const applications: ACItem[] = APP_DEFINITIONS.filter(app => app.applicationId !== 'home').map(
    app => ({
      id: app.applicationId,
      label: app.name,
      kind: 'application' as const,
      applicationId: app.applicationId,
      tabs: perms.canManageAccess ? [{ id: 'access', label: 'Access' }] : []
    })
  );

  const capabilities: ACItem[] = perms.canManageBindings
    ? CAPABILITY_TYPES.map(type => ({
        id: type,
        label: getWorkspaceCapabilityDefinition(type)?.label ?? type,
        kind: 'capability' as const,
        capabilityType: type,
        tabs: [{ id: 'bindings', label: 'Binding' }]
      }))
    : [];

  return { applications, capabilities };
};

/** Resolve the selected sidebar entry, falling back to the first available one. */
export const findApplicationsCapabilitiesItem = (
  perms: ApplicationsCapabilitiesPermissions,
  itemId: string | undefined
): ACItem | undefined => {
  const { applications, capabilities } = buildApplicationsCapabilitiesItems(perms);
  const all = [...applications, ...capabilities];
  return all.find(item => item.id === itemId) ?? all[0];
};

/** Resolve the active tab for an item, falling back to its first tab. */
export const resolveApplicationsCapabilitiesTab = (
  item: ACItem,
  tabId: string | undefined
): string => item.tabs.find(tab => tab.id === tabId)?.id ?? item.tabs[0]?.id ?? 'access';
