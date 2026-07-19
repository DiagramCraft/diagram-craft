import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineEntityOperation } from '../operation';
import { defineOperation } from '../operation';

import { buildApiEntityAuthCtx, requireWorkspaceCapability } from '../auth/authorization';

import { httpAssert } from '../../utils/httpAssert';

import type { AiActionTestEvent, RunAiActionEvent } from '@arch-register/api-types/projectContract';
import type { DocumentAiAction } from '@arch-register/api-types/documentContract';
import { chat } from '@tanstack/ai';
import { resolveAiConfig, createAiTextAdapter } from '../ai/tanstackAiAdapter';
import { createAiChatTools } from '../ai/chatTools';
import { buildDocumentActionPrompt } from '../ai/documentContextPromptBuilder';
import {
  documentMetadataGenerationOutputSchema,
  parseGeneratedResponse,
  type ParsedDocumentAiResponse
} from '../document/documentAiValue';
import {
  validateDocumentMetadata,
  validateDocumentTypeWrite
} from '../document/documentValidation';

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

export const testDocumentAiAction = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  documentTypeId: string,
  action: DocumentAiAction,
  event: AuthenticatedEvent
): Promise<AsyncGenerator<AiActionTestEvent>> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to test AI action',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.settings');

      const node = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
      httpAssert.true(isMarkdownNode(node), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');

      const document = await getDocumentState(db, ws, node);
      httpAssert.present(document.documentType, {
        status: 400,
        message: 'The selected document does not have a document type'
      });
      httpAssert.true(document.documentTypeId === documentTypeId, {
        status: 409,
        message: 'The selected document does not use the document type being edited'
      });

      const actions = document.documentType.aiActions.filter(
        candidate => candidate.id !== action.id
      );
      validateDocumentTypeWrite({
        name: document.documentType.name,
        description: document.documentType.description,
        fields: document.documentType.fields,
        aiActions: [...actions, action]
      });

      const outputField =
        action.kind === 'metadata_generator'
          ? (document.documentType.fields.find(field => field.id === action.outputFieldId) ?? null)
          : null;

      const aiConfig = await resolveAiConfig(db, ws);
      httpAssert.present(aiConfig, {
        status: 503,
        message: 'AI is not configured for this workspace'
      });

      const content = await storage.read(ws, storageScope(ws, node), node.id);
      const prompt = buildDocumentActionPrompt({
        documentTitle: node.name,
        locationPath: node.path,
        documentType: {
          ...document.documentType,
          version: document.documentType.version ?? 1,
          created_at: document.documentType.created_at.toISOString(),
          updated_at: document.documentType.updated_at.toISOString()
        },
        metadata: document.metadata,
        body: readMarkdownBody(content),
        actionPrompt: action.prompt,
        outputField: outputField ?? undefined
      });

      const entityAuthCtx = await buildApiEntityAuthCtx(db, ws, event);
      const tools = createAiChatTools(
        db,
        ws,
        entityAuthCtx,
        { id: event.context.user.id, displayName: event.context.user.display_name },
        { readOnly: true }
      );

      const adapter = createAiTextAdapter(aiConfig);
      const isMetadataGenerator = action.kind === 'metadata_generator' && outputField !== null;
      const stream = isMetadataGenerator
        ? null
        : chat({
            adapter,
            messages: [{ role: 'user', content: prompt }],
            tools,
            temperature: aiConfig.temperature,
            stream: true
          });

      return (async function* testAndStream(): AsyncGenerator<AiActionTestEvent> {
        const startedAt = Date.now();
        const capturedContent: string[] = [];
        const toolCalls: Array<{
          name: string;
          status: 'completed' | 'failed';
          error: string | null;
        }> = [];
        const errors: string[] = [];
        let streamError: string | null = null;

        if (isMetadataGenerator && outputField) {
          let rawOutput = '';
          let parsedValue = null;
          let status: 'success' | 'invalid_output' | 'failed' = 'success';

          try {
            let generatedResponse: ParsedDocumentAiResponse;
            try {
              const structured = await chat({
                adapter,
                messages: [{ role: 'user', content: prompt }],
                tools,
                temperature: aiConfig.temperature,
                outputSchema: documentMetadataGenerationOutputSchema(outputField)
              });
              rawOutput = JSON.stringify(structured);
              generatedResponse = parseGeneratedResponse(outputField, rawOutput);
              if (!generatedResponse.ok) throw new Error(generatedResponse.error);
            } catch {
              const legacyAnswer = await chat({
                adapter,
                messages: [{ role: 'user', content: prompt }],
                tools,
                temperature: aiConfig.temperature,
                stream: false
              });
              rawOutput =
                typeof legacyAnswer === 'string' ? legacyAnswer : JSON.stringify(legacyAnswer);
              generatedResponse = parseGeneratedResponse(outputField, rawOutput);
              if (!generatedResponse.ok) throw new Error(generatedResponse.error);
            }

            parsedValue = generatedResponse.value;
            const validation = validateDocumentMetadata(
              [outputField],
              { [outputField.id]: parsedValue },
              false,
              false
            );
            if (validation.errors.length > 0) {
              status = 'invalid_output';
              errors.push(...validation.errors);
            }
          } catch (cause) {
            status = 'failed';
            errors.push(
              `AI request failed: ${cause instanceof Error ? cause.message : String(cause)}`
            );
          }

          yield {
            type: 'done',
            actionId: action.id,
            actionName: action.name,
            kind: action.kind,
            prompt: action.prompt,
            documentTitle: node.name,
            nodeId: node.id,
            provider: aiConfig.provider,
            model: aiConfig.model,
            durationMs: Date.now() - startedAt,
            rawOutput,
            parsedValue,
            outputFieldId: outputField.id,
            status,
            errors,
            toolCalls
          };
          return;
        }

        try {
          // biome-ignore lint/suspicious/noExplicitAny: Stream chunk type varies by AI provider implementation
          for await (const chunk of stream as AsyncIterable<any>) {
            if (chunk.type === 'TEXT_MESSAGE_CONTENT' && chunk.delta) {
              capturedContent.push(chunk.delta);
              yield { type: 'delta', delta: chunk.delta };
            }
            if (chunk.type === 'TOOL_CALL_START' && chunk.toolCallName) {
              toolCalls.push({ name: chunk.toolCallName, status: 'completed', error: null });
            }
            if (chunk.type === 'TOOL_CALL_RESULT' && toolCalls.length > 0) {
              const result = chunk.content;
              if (typeof result === 'string' && /\berror\b/i.test(result)) {
                const current = toolCalls[toolCalls.length - 1]!;
                current.status = 'failed';
                current.error = result;
                errors.push(`${current.name}: ${result}`);
              }
            }
          }
        } catch (cause) {
          streamError = cause instanceof Error ? cause.message : String(cause);
          errors.push(`AI request failed: ${streamError}`);
        }

        const rawOutput = capturedContent.join('');
        let parsedValue = null;
        let status: 'success' | 'invalid_output' | 'failed' = streamError ? 'failed' : 'success';

        if (!streamError && action.kind === 'metadata_generator' && outputField) {
          const parsed = parseGeneratedResponse(outputField, rawOutput);
          if (!parsed.ok) {
            status = 'invalid_output';
            errors.push(parsed.error);
          } else {
            parsedValue = parsed.value;
            const validation = validateDocumentMetadata(
              [outputField],
              { [outputField.id]: parsed.value },
              false,
              false
            );
            if (validation.errors.length > 0) {
              status = 'invalid_output';
              errors.push(...validation.errors);
            }
          }
        }

        yield {
          type: 'done',
          actionId: action.id,
          actionName: action.name,
          kind: action.kind,
          prompt: action.prompt,
          documentTitle: node.name,
          nodeId: node.id,
          provider: aiConfig.provider,
          model: aiConfig.model,
          durationMs: Date.now() - startedAt,
          rawOutput,
          parsedValue,
          outputFieldId: outputField?.id ?? null,
          status,
          errors,
          toolCalls
        };
      })();
    }
  );
};
