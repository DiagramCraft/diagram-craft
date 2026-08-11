import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateWebhookQueries, webhooksQuery, type WebhookInput } from '../queries/webhooks';

export type { WebhookInput } from '../queries/webhooks';

export const useWebhooks = (workspace: string) =>
  useQuery({
    ...webhooksQuery(workspace)
  });

export const useWebhookOperations = (workspace: string) => {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateWebhookQueries(queryClient, workspace);
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
