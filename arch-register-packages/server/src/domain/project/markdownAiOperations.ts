import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineEntityOperation } from '../operation';

import { httpAssert } from '../../utils/httpAssert';

import type { RunAiActionEvent } from '@arch-register/api-types/projectContract';
import { chat } from '@tanstack/ai';
import { resolveAiConfig, createAiTextAdapter } from '../ai/tanstackAiAdapter';
import { createAiChatTools } from '../ai/chatTools';
import { buildDocumentActionPrompt } from '../ai/documentContextPromptBuilder';

import { projectDbErrorMessages, storageScope } from './projectOperationHelpers';

import {
  getDocumentState,
  requireMarkdownNodeAccess,
  isMarkdownNode,
  readMarkdownBody
} from './markdownOperationHelpers';
export const runDocumentAiAction = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  actionId: string,
  event: AuthenticatedEvent
): Promise<AsyncGenerator<RunAiActionEvent>> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to run AI action',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');

      const document = await getDocumentState(db, ws, node);
      const action = document.documentType?.aiActions.find(
        candidate =>
          candidate.id === actionId && candidate.enabled && candidate.kind === 'interactive'
      );
      httpAssert.present(action, {
        status: 404,
        message: `AI action '${actionId}' not found or disabled`
      });

      const aiConfig = await resolveAiConfig(db, ws);
      httpAssert.present(aiConfig, {
        status: 503,
        message: 'AI is not configured for this workspace'
      });

      const content = await storage.read(ws, storageScope(ws, node), node.id);
      const prompt = buildDocumentActionPrompt({
        documentTitle: node.name,
        locationPath: node.path,
        documentType: document.documentType
          ? {
              ...document.documentType,
              version: document.documentType.version ?? 1,
              created_at: document.documentType.created_at.toISOString(),
              updated_at: document.documentType.updated_at.toISOString()
            }
          : null,
        metadata: document.metadata,
        body: readMarkdownBody(content),
        actionPrompt: action.prompt
      });

      const adapter = createAiTextAdapter(aiConfig);
      const tools = createAiChatTools(
        db,
        ws,
        authCtx,
        { id: event.context.user.id, displayName: event.context.user.display_name },
        { readOnly: true }
      );

      const stream = chat({
        adapter,
        messages: [{ role: 'user', content: prompt }],
        tools,
        temperature: aiConfig.temperature,
        stream: true
      });

      return (async function* runAndStreamAnswer(): AsyncGenerator<RunAiActionEvent> {
        const capturedContent: string[] = [];
        // biome-ignore lint/suspicious/noExplicitAny: Stream chunk type varies by AI provider implementation
        for await (const chunk of stream as AsyncIterable<any>) {
          if (
            (chunk.type === 'TEXT_MESSAGE_CONTENT' || chunk.type === 'REASONING_MESSAGE_CONTENT') &&
            chunk.delta
          ) {
            capturedContent.push(chunk.delta);
            yield { type: 'delta', delta: chunk.delta };
          }
        }

        yield {
          type: 'done',
          actionId: action.id,
          actionName: action.name,
          prompt: action.prompt,
          answer: capturedContent.join(''),
          documentTitle: node.name,
          nodeId: node.id
        };
      })();
    }
  );
};
