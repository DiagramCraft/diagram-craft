import { useLocation } from '@tanstack/react-router';
import { useAuthConfig } from '../../hooks/useAuthConfig';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';

export type GlobalSettingsSection = 'global-permissions' | 'users' | 'security-events' | 'demo';

export const useGlobalSettingsSection = () => {
  const location = useLocation();
  const ctx = useWorkspaceContext();
  const { data: authConfig } = useAuthConfig();
  const { hasGlobalPermission } = useWorkspaceAuthorization(ctx.workspace?.id);

  const section: GlobalSettingsSection = location.pathname.endsWith('/users')
    ? 'users'
    : location.pathname.endsWith('/security-events')
      ? 'security-events'
      : location.pathname.endsWith('/demo')
        ? 'demo'
        : 'global-permissions';
  const canManageUsers =
    authConfig != null && authConfig.mode !== 'oidc' && hasGlobalPermission('admin_platform');

  return { section, canManageUsers, authConfigLoaded: authConfig != null };
};
