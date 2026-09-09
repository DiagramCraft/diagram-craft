import type { QueryClient } from '@tanstack/react-query';
import type { WorkspaceApplicationId } from '@arch-register/api-types/workspaceConfigContract';
import { ApiError } from '../lib/http';
import { accessibleApplicationsQuery } from '../queries/workspaceConfig';

export const ensureApplicationAccess = async (
  queryClient: QueryClient,
  workspaceSlug: string,
  applicationId: Exclude<WorkspaceApplicationId, 'home'>
) => {
  const access = await queryClient.fetchQuery(accessibleApplicationsQuery(workspaceSlug, true));

  if (!access.installed_application_ids.includes(applicationId)) {
    throw new ApiError(404, 'This application is not configured for the workspace');
  }

  if (!access.accessible_application_ids.includes(applicationId)) {
    throw new ApiError(
      403,
      'You do not have access to this application. Ask a workspace administrator for access.'
    );
  }
};
