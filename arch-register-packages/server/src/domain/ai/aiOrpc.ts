import { defineHandler } from 'h3';
import { implement, ORPCError } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { aiContract } from '@arch-register/api-types';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError } from '../../utils/orpcErrors';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveAiConfig, createAiTextAdapter } from './tanstackAiAdapter';
import {
  createAiConfigResponse,
  buildAiConfigInput,
  parseExtractResponse
} from './aiRoutes';
import { chat } from '@tanstack/ai';
import { buildSystemPrompt } from './systemPromptBuilder';

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
  chatImpl?: typeof chat;
  resolveAiConfigImpl?: typeof resolveAiConfig;
  createAiTextAdapterImpl?: typeof createAiTextAdapter;
  buildSystemPromptImpl?: typeof buildSystemPrompt;
};

const aiRouter = implement(aiContract).$context<ORPCContext>();

export const createAiORPCRouter = (deps: AiORPCDeps = {}) => {
  const chatImpl = deps.chatImpl ?? chat;
  const resolveAi = deps.resolveAiConfigImpl ?? resolveAiConfig;
  const createAdapter = deps.createAiTextAdapterImpl ?? createAiTextAdapter;
  const buildPrompt = deps.buildSystemPromptImpl ?? buildSystemPrompt;

  return aiRouter.router({
  ai: {
    listConversations: aiRouter.ai.listConversations.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;
        const conversations = await context.db.ai.listConversations(workspace, user.id);
        return conversations.map(toConversationResponse);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    createConversation: aiRouter.ai.createConversation.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;
        const title = typeof input.title === 'string' && input.title.length > 0 ? input.title : 'New conversation';
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
      } catch (error) {
        return toORPCError(error);
      }
    }),

    updateConversation: aiRouter.ai.updateConversation.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;

        const conversation = await context.db.ai.getConversation(workspace, input.conversationId);
        if (!conversation) throw new ORPCError('NOT_FOUND', { message: 'Conversation not found' });
        if (conversation.user_id !== user.id) {
          throw new ORPCError('FORBIDDEN', { message: "Cannot modify another user's conversation" });
        }

        const updated = await context.db.ai.updateConversationTitle(workspace, input.conversationId, input.title);
        if (!updated) throw new ORPCError('NOT_FOUND', { message: 'Conversation not found' });
        return toConversationResponse(updated);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    deleteConversation: aiRouter.ai.deleteConversation.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;

        const conversation = await context.db.ai.getConversation(workspace, input.conversationId);
        if (!conversation) throw new ORPCError('NOT_FOUND', { message: 'Conversation not found' });
        if (conversation.user_id !== user.id) {
          throw new ORPCError('FORBIDDEN', { message: "Cannot delete another user's conversation" });
        }

        const deleted = await context.db.ai.deleteConversation(workspace, input.conversationId);
        if (!deleted) throw new ORPCError('NOT_FOUND', { message: 'Conversation not found' });
        return toConversationResponse(deleted);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    listMessages: aiRouter.ai.listMessages.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        const user = context.event.context.user;

        const conversation = await context.db.ai.getConversation(workspace, input.conversationId);
        if (!conversation) throw new ORPCError('NOT_FOUND', { message: 'Conversation not found' });
        if (conversation.user_id !== user.id) {
          throw new ORPCError('FORBIDDEN', { message: "Cannot access another user's conversation" });
        }

        const messages = await context.db.ai.listMessages(input.conversationId);
        return messages.map(toMessageResponse);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    getConfig: aiRouter.ai.getConfig.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.settings');
        const config = await context.db.ai.getAiConfig(workspace);
        return createAiConfigResponse(workspace, config);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    updateConfig: aiRouter.ai.updateConfig.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.settings');
        const { workspace: _ws, ...body } = input;
        const configInput = buildAiConfigInput(body as Record<string, unknown>);
        const config = await context.db.ai.upsertAiConfig(workspace, configInput);
        return createAiConfigResponse(workspace, config);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    extract: aiRouter.ai.extract.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');

        const aiConfig = await resolveAi(context.db, workspace);
        if (!aiConfig) {
          throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'AI is not configured for this workspace' });
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
        const systemPrompt = await buildPrompt(context.db, workspace, extractPrompt);
        const result = await chatImpl({
          adapter,
          messages: [{ role: 'user', content: input.text }],
          systemPrompts: [systemPrompt],
          temperature: 0.3,
          stream: false
        });

        return parseExtractResponse(result as string);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});
};

export const createAiORPCHandler = (db: DatabaseAdapter, deps: AiORPCDeps = {}) => {
  const aiOpenAPIHandler = new OpenAPIHandler(createAiORPCRouter(deps));

  return defineHandler(async event => {
    const result = await aiOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
