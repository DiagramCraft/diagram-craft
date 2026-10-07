import { useQuery } from '@tanstack/react-query';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { workspaceCapabilityConfigurationsQuery } from '../queries/workspaceConfig';
import type { AppDefinition } from './shellTypes';

export const isAppEnabled = (
  app: Pick<AppDefinition, 'enablement' | 'resolveConfig'>,
  configurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): boolean => {
  if (app.resolveConfig) return app.resolveConfig(configurations) != null;
  if (app.enablement === 'always') return true;
  const { capabilityType } = app.enablement;
  return configurations?.some(c => c.type === capabilityType && c.valid) ?? false;
};

/** Whether the app's capability is configured; `isLoading` takes priority over `isEnabled`. */
export const useAppEnabled = (app: AppDefinition, workspaceSlug: string) => {
  const configurations = useQuery(
    workspaceCapabilityConfigurationsQuery(workspaceSlug, app.enablement !== 'always')
  );
  return {
    isLoading: configurations.isLoading,
    isEnabled: isAppEnabled(app, configurations.data)
  };
};
