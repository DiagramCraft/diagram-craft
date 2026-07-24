import { defineHandler } from 'h3';
import { implement, ORPCError } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { aiContract } from '@arch-register/api-types/aiContract';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { buildApiEntityAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveAiConfig, createAiTextAdapter } from './tanstackAiAdapter';
import {
  createAiConfigResponse,
  buildAiConfigInput,
  parseExtractResponse,
  extractUserTextContent,
  buildConversationAutoTitle
} from './aiHelpers';
import { chat } from '@tanstack/ai';
import { buildSystemPrompt } from './systemPromptBuilder';
import { createAiChatTools } from './chatTools';
import { httpAssert } from '@arch-register/server/utils/httpAssert';
import { orpcAssert } from '@arch-register/server/utils/orpcAssert';
import { AiEncryptionError } from '../../utils/encryption';

const toConversationResponse = (c: {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}) => ({
  id: c.id,
  workspace: c.workspace,
  user_id: c.user_id,
  title: c.title,
  created_at: c.created_at.toISOString(),
  updated_at: c.updated_at.toISOString()
});

const toMessageResponse = (m: {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}) => ({
  id: m.id,
  conversation_id: m.conversation_id,
  role: m.role,
  content: m.content,
  metadata: m.metadata,
  created_at: m.created_at.toISOString()
});

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

type AiORPCDeps = {
  chatImpl?: (options: Record<string, unknown>) => unknown;
  resolveAiConfigImpl?: typeof resolveAiConfig;
  createAiTextAdapterImpl?: typeof createAiTextAdapter;
  buildSystemPromptImpl?: typeof buildSystemPrompt;
  createAiChatToolsImpl?: typeof createAiChatTools;
  randomId?: () => string;
};

const aiRouter = implement(aiContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const createAiORPCRouter = (deps: AiORPCDeps = {}) => {
  const chatImpl = deps.chatImpl ?? chat;
  const resolveAi = deps.resolveAiConfigImpl ?? resolveAiConfig;
  const createAdapter = deps.createAiTextAdapterImpl ?? createAiTextAdapter;
  const buildPrompt = deps.buildSystemPromptImpl ?? buildSystemPrompt;
  const createTools = deps.createAiChatToolsImpl ?? createAiChatTools;
  const makeId = deps.randomId ?? randomUUID;

  return aiRouter.router({
    ai: {
      listConversations: aiRouter.ai.listConversations.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;
        const conversations = await context.db.ai.listConversations(workspace, user.id);
        return conversations.map(toConversationResponse);
      }),

      createConversation: aiRouter.ai.createConversation.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;
        const title =
          typeof input.body.title === 'string' && input.body.title.length > 0
            ? input.body.title
            : 'New conversation';
        const now = new Date();
        const conv = await context.db.ai.createConversation({
          id: randomUUID(),
          workspace,
          user_id: user.id,
          title,
          created_at: now,
          updated_at: now
        });
        return toConversationResponse(conv);
      }),

      updateConversation: aiRouter.ai.updateConversation.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;

        const conversation = await context.db.ai.getConversation(workspace, input.params.id);
        orpcAssert.present(conversation, {
          code: 'NOT_FOUND',
          message: 'Conversation not found'
        });
        orpcAssert.true(conversation.user_id === user.id, {
          code: 'FORBIDDEN',
          message: "Cannot modify another user's conversation"
        });

        const updated = await context.db.ai.updateConversationTitle(
          workspace,
          input.params.id,
          input.body.title
        );
        orpcAssert.present(updated, { code: 'NOT_FOUND', message: 'Conversation not found' });
        return toConversationResponse(updated);
      }),

      deleteConversation: aiRouter.ai.deleteConversation.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;

        const conversation = await context.db.ai.getConversation(workspace, input.params.id);
        orpcAssert.present(conversation, {
          code: 'NOT_FOUND',
          message: 'Conversation not found'
        });
        orpcAssert.true(conversation.user_id === user.id, {
          code: 'FORBIDDEN',
          message: "Cannot delete another user's conversation"
        });

        const deleted = await context.db.ai.deleteConversation(workspace, input.params.id);
        orpcAssert.present(deleted, { code: 'NOT_FOUND', message: 'Conversation not found' });
        return toConversationResponse(deleted);
      }),

      listMessages: aiRouter.ai.listMessages.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;

        const conversation = await context.db.ai.getConversation(workspace, input.params.id);
        orpcAssert.present(conversation, {
          code: 'NOT_FOUND',
          message: 'Conversation not found'
        });
        orpcAssert.true(conversation.user_id === user.id, {
          code: 'FORBIDDEN',
          message: "Cannot access another user's conversation"
        });

        const messages = await context.db.ai.listMessages(input.params.id);
        return messages.map(toMessageResponse);
      }),

      getStatus: aiRouter.ai.getStatus.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');

        const aiConfig = await resolveAi(context.db, workspace);
        return { configured: aiConfig !== null };
      }),

      getConfig: aiRouter.ai.getConfig.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.settings');

        const config = await context.db.ai.getAiConfig(workspace);
        httpAssert.present(config, { status: 404, message: `Config not found` });

        return createAiConfigResponse(config);
      }),

      updateConfig: aiRouter.ai.updateConfig.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.settings');
        let configInput: ReturnType<typeof buildAiConfigInput>;
        try {
          configInput = buildAiConfigInput(input.body as Record<string, unknown>);
        } catch (error) {
          if (error instanceof AiEncryptionError) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
              message: 'AI credential encryption is not configured correctly'
            });
          }
          throw error;
        }
        const config = await context.db.ai.upsertAiConfig(workspace, configInput);
        return createAiConfigResponse(config);
      }),

      extract: aiRouter.ai.extract.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');

        const aiConfig = await resolveAi(context.db, workspace);
        if (!aiConfig) {
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: 'AI is not configured for this workspace'
          });
        }

        const schemas = await context.db.catalog.listSchemas(workspace);
        const schemaDescriptions = schemas
          .map(s => {
            const fields = s.fields.map(f => `${f.name} (${f.type})`).join(', ');
            return `- ${s.name} (id: ${s.id}): fields: ${fields}`;
          })
          .join('\n');

        const extractPrompt = [
          'You are an entity extraction assistant. Extract architecture entities from the provided text.',
          '',
          '## Available schemas',
          schemaDescriptions,
          '',
          '## Instructions',
          '- Extract entities that match the available schemas.',
          '- For each entity, provide: name, schema_id, and field values.',
          '- For reference and containment fields, provide the NAMES of related entities (not IDs).',
          '- If multiple related entities, separate names with commas.',
          '- Include a confidence score (0-1) for each extracted entity.',
          '- Include the source text snippet that supports each extraction.',
          '- Return a JSON array of extracted entities.',
          '',
          '## Output format',
          'Return ONLY valid JSON in this format:',
          '```json',
          '[{',
          '  "name": "Entity Name",',
          '  "schema_id": "schema-uuid",',
          '  "fields": { "fieldName": "value", "relationField": "RelatedEntity1, RelatedEntity2" },',
          '  "confidence": 0.85,',
          '  "source": "relevant text snippet"',
          '}]',
          '```'
        ].join('\n');

        const adapter = createAdapter(aiConfig);
        const entityAuthCtx = await buildApiEntityAuthCtx(context.db, workspace, context.event);
        const systemPrompt = await buildPrompt(context.db, workspace, entityAuthCtx, extractPrompt);
        const result = await chatImpl({
          adapter,
          messages: [{ role: 'user', content: input.body.text }],
          systemPrompts: [systemPrompt],
          temperature: 0.3,
          stream: false
        });

        return parseExtractResponse(result as string);
      }),

      chat: aiRouter.ai.chat.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');

        const aiConfig = await resolveAi(context.db, workspace);
        if (!aiConfig) {
          throw new ORPCError('SERVICE_UNAVAILABLE', {
            message: 'AI is not configured for this workspace'
          });
        }

        const entityAuthCtx = await buildApiEntityAuthCtx(context.db, workspace, context.event);
        const systemPrompt = await buildPrompt(
          context.db,
          workspace,
          entityAuthCtx,
          aiConfig.systemPrompt
        );
        const adapter = createAdapter(aiConfig);
        const user = context.event.context.user;
        const tools = createTools(context.db, workspace, entityAuthCtx, {
          id: user.id,
          displayName: user.display_name
        });

        const stream = chatImpl({
          adapter,
          // biome-ignore lint/suspicious/noExplicitAny: TanStack AI chat message types are complex and vary by provider
          messages: input.body.messages as any,
          systemPrompts: [systemPrompt],
          tools,
          temperature: aiConfig.temperature,
          threadId: input.body.threadId,
          runId: input.body.runId,
          parentRunId: input.body.parentRunId
        });

        const conversationId =
          // biome-ignore lint/suspicious/noExplicitAny: forwardedProps type varies by client implementation
          (input.body.forwardedProps as any)?.conversationId ?? input.body.conversationId;

        if (conversationId) {
          // biome-ignore lint/suspicious/noExplicitAny: Message array type varies by AI provider
          const lastUserMsg = [...(input.body.messages as any[])]
            .reverse()
            .find(m => m.role === 'user');
          if (lastUserMsg) {
            const textContent = extractUserTextContent(lastUserMsg);
            if (textContent) {
              await context.db.ai.createMessage({
                id: makeId(),
                conversation_id: conversationId,
                role: 'user',
                content: textContent,
                metadata: {},
                created_at: new Date()
              });

              await context.db.ai.initConversationTitle(
                workspace,
                conversationId,
                buildConversationAutoTitle(textContent)
              );
            }
          }
        }

        return (async function* () {
          const capturedContent: string[] = [];
          const capturedToolCalls: Array<{ name: string; args: string; result?: unknown }> = [];

          try {
            // biome-ignore lint/suspicious/noExplicitAny: Stream chunk type varies by AI provider implementation
            for await (const chunk of stream as AsyncIterable<any>) {
              if (
                (chunk.type === 'TEXT_MESSAGE_CONTENT' ||
                  chunk.type === 'REASONING_MESSAGE_CONTENT') &&
                chunk.delta
              ) {
                capturedContent.push(chunk.delta);
              }
              if (chunk.type === 'TOOL_CALL_START' && chunk.toolCallName) {
                capturedToolCalls.push({
                  name: chunk.toolCallName,
                  args: '',
                  result: undefined
                });
              }
              if (chunk.type === 'TOOL_CALL_ARGS' && capturedToolCalls.length > 0) {
                capturedToolCalls[capturedToolCalls.length - 1]!.args += chunk.delta ?? '';
              }
              if (chunk.type === 'TOOL_CALL_RESULT' && capturedToolCalls.length > 0) {
                capturedToolCalls[capturedToolCalls.length - 1]!.result = chunk.content;
              }

              yield chunk;
            }

            if (conversationId && capturedContent.length > 0) {
              const metadata: Record<string, unknown> = {};
              if (capturedToolCalls.length > 0) metadata.toolCalls = capturedToolCalls;
              await context.db.ai.createMessage({
                id: makeId(),
                conversation_id: conversationId,
                role: 'assistant',
                content: capturedContent.join(''),
                metadata,
                created_at: new Date()
              });
            }
          } catch (error) {
            const isAbort =
              error instanceof Error &&
              (error.name === 'AbortError' || error.message.includes('aborted'));
            if (isAbort && conversationId && capturedContent.length > 0) {
              const metadata: Record<string, unknown> = {};
              if (capturedToolCalls.length > 0) metadata.toolCalls = capturedToolCalls;
              await context.db.ai
                .createMessage({
                  id: makeId(),
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: capturedContent.join(''),
                  metadata,
                  created_at: new Date()
                })
                .catch(() => undefined);
            }
            throw error;
          }
        })();
      })
    }
  });
};

export const createAiORPCHandler = (db: DatabaseAdapter, deps: AiORPCDeps = {}) => {
  const aiOpenAPIHandler = new OpenAPIHandler(createAiORPCRouter(deps), {
    clientInterceptors: orpcErrorInterceptors
  });

  return defineHandler(async event => {
    const result = await aiOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
