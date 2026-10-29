import { WORKSPACE_CAPABILITY_GROUPS } from '@arch-register/permissions';

/**
 * User-facing capability names, taken from the permission matrix so both stay in sync. Capabilities
 * that are not part of the matrix (API-token-only ones) are added explicitly.
 */
const WORKSPACE_CAPABILITY_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    WORKSPACE_CAPABILITY_GROUPS.flatMap(group => group.caps.map(cap => [cap.id, cap.name]))
  ),
  'ent.external_update': 'Update externally managed fields'
};

export const getWorkspaceCapabilityLabel = (capability: string) =>
  WORKSPACE_CAPABILITY_LABELS[capability] ?? capability;
