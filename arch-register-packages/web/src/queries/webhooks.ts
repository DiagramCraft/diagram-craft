import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { WebhookEventFilter } from '@arch-register/api-types/webhookContract';
import { orpcClient } from '../lib/orpcClient';

export type WebhookInput = { url: string; event_filter: WebhookEventFilter; enabled: boolean };

export const webhookKeys = {
  all: ['webhooks'] as const,
  list: (workspaceId: string) => [...webhookKeys.all, workspaceId] as const
};

export const webhooksQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: webhookKeys.list(workspaceId),
    queryFn: () => orpcClient.webhooks.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });

export const invalidateWebhookQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: webhookKeys.list(workspaceId) });
