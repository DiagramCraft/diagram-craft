import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WebhookEventFilter } from '@arch-register/api-types/webhookContract';
import { orpcClient } from '../lib/orpcClient';

const keys = { list: (workspace: string) => ['webhooks', workspace] as const };
export type WebhookInput = { url: string; event_filter: WebhookEventFilter; enabled: boolean };

export const useWebhooks = (workspace: string) =>
  useQuery({
    queryKey: keys.list(workspace),
    queryFn: () => orpcClient.webhooks.list({ params: { workspace } }),
    enabled: !!workspace
  });

export const useWebhookOperations = (workspace: string) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.list(workspace) });
  const create = useMutation({
    mutationFn: (body: WebhookInput) => orpcClient.webhooks.create({ params: { workspace }, body }),
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: WebhookInput & { id: string }) =>
      orpcClient.webhooks.update({ params: { workspace, id }, body }),
    onSuccess: invalidate
  });
  const remove = useMutation({
    mutationFn: (id: string) => orpcClient.webhooks.remove({ params: { workspace, id } }),
    onSuccess: invalidate
  });
  const rotateSecret = useMutation({
    mutationFn: (id: string) => orpcClient.webhooks.rotateSecret({ params: { workspace, id } }),
    onSuccess: invalidate
  });
  return { create, update, remove, rotateSecret };
};
