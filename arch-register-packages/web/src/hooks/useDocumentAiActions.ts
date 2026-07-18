import { orpcClient } from '../lib/orpcClient';
import type { RunAiActionResponse } from '@arch-register/api-types/projectContract';

export const runDocumentAiAction = async (
  workspaceSlug: string,
  nodeId: string,
  actionId: string,
  onDelta: (delta: string) => void
): Promise<RunAiActionResponse> => {
  const stream = await orpcClient.projects.runDocumentAiAction({
    params: { workspace: workspaceSlug, nodeId, actionId }
  });

  for await (const event of stream) {
    if (event.type === 'delta') onDelta(event.delta);
    else return event;
  }

  throw new Error('AI action stream ended without a result');
};
