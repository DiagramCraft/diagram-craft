import { orpcClient } from '../lib/orpcClient';
import type {
  AiActionTestEvent,
  AiActionTestResult,
  RunAiActionResponse
} from '@arch-register/api-types/projectContract';
import type { DocumentAiAction } from '@arch-register/api-types/documentContract';

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

export const testDocumentAiAction = async (
  workspaceSlug: string,
  nodeId: string,
  documentTypeId: string,
  action: DocumentAiAction,
  onDelta: (delta: string) => void
): Promise<AiActionTestResult> => {
  const stream = await orpcClient.projects.testDocumentAiAction({
    params: { workspace: workspaceSlug, nodeId },
    body: { documentTypeId, action }
  });

  for await (const event of stream as AsyncIterable<AiActionTestEvent>) {
    if (event.type === 'delta') onDelta(event.delta);
    else return event;
  }

  throw new Error('AI action test stream ended without a result');
};
