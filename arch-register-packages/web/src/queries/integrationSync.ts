import { queryOptions } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const integrationSyncDashboardKey = (workspace: string) =>
  ['integration-sync-dashboard', workspace] as const;

export const integrationSyncDashboardQuery = (workspace: string) =>
  queryOptions({
    queryKey: integrationSyncDashboardKey(workspace),
    queryFn: () => orpcClient.integrationSync.dashboard({ params: { workspace } })
  });

export const configureIntegrationSource = (
  workspace: string,
  sourceKey: string,
  body: {
    displayName: string;
    type: string;
    owner?: string | null;
    status?: 'active' | 'paused';
  }
) =>
  orpcClient.config.integrationSources.upsert({
    params: { workspace, sourceKey },
    body
  });

export const retryIntegrationSyncRun = (workspace: string, runId: string) =>
  orpcClient.integrationSync.retryRun({ params: { workspace, runId } });

export const relinkIntegrationSyncRecord = (workspace: string, id: string, recordId: string) =>
  orpcClient.integrationSync.relinkRecord({
    params: { workspace, id },
    body: { recordId, confirm: true }
  });

export const stopManagingIntegrationSyncRecord = (workspace: string, id: string) =>
  orpcClient.integrationSync.stopManaging({
    params: { workspace, id },
    body: { confirm: true }
  });
