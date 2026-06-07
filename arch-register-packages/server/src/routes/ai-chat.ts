import { randomUUID } from 'node:crypto';
import { H3, defineHandler, HTTPError } from 'h3';
import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from '@tanstack/ai';
import type { DatabaseAdapter } from '../db/database';
import { resolveWorkspace } from '../api-helpers/resolveWorkspace';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../middleware/auth';
import { httpAssert } from '../utils/httpAssert';
import { encrypt } from '../utils/encryption';
import { resolveAiConfig, createAiTextAdapter } from '../ai/tanstackAiAdapter';
import { buildSystemPrompt } from '../ai/systemPromptBuilder';
import { createAiChatTools } from '../ai/chatTools';
import type { UpsertAiConfigInput } from '../db/database';
import type { WorkspaceAiConfig } from '../types';

const BASE = '/api/:workspace/ai';

type ChatChunk = {
  type: string;
  delta?: unknown;
  toolCallName?: unknown;
  content?: unknown;
};

type AiChatRouteDeps = {
  chatImpl?: (options: Record<string, unknown>) => unknown;
  chatParamsFromRequestBodyImpl?: (body: unknown) => Promise<{
    messages: Array<{
      role: string;
      content?: unknown;
      parts?: Array<{ type?: string; content?: string }>;
    }>;
    threadId: string;
    runId: string;
    parentRunId?: string;
    tools: unknown[];
    forwardedProps: Record<string, unknown>;
    state: unknown;
    context: unknown[];
  }>;
  toServerSentEventsResponseImpl?: (
    stream: AsyncIterable<unknown>,
    init?: ResponseInit & { abortController?: AbortController }
  ) => Response;
  resolveAiConfigImpl?: typeof resolveAiConfig;
  createAiTextAdapterImpl?: typeof createAiTextAdapter;
  buildSystemPromptImpl?: typeof buildSystemPrompt;
  createAiChatToolsImpl?: typeof createAiChatTools;
  randomId?: () => string;
};

export const extractUserTextContent = (message: {
  content?: unknown;
  parts?: Array<{ type?: string; content?: string }>;
}): string => {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => part.content ?? '')
      .join('');
  }

  const content = message.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { type?: string; content?: string } =>
          part != null && typeof part === 'object'
      )
      .filter(part => part.type === 'text')
      .map(part => part.content ?? '')
      .join('');
  }
  return '';
};

export const buildConversationAutoTitle = (text: string) =>
  text.length > 50 ? `${text.substring(0, 47)}...` : text;

export const createAiConfigResponse = (workspace: string, config: WorkspaceAiConfig | null) => {
  if (!config) {
    return {
      workspace,
      provider: 'openrouter',
      base_url: null,
      model: null,
      temperature: null,
      system_prompt: null,
      enabled: false,
      has_api_key: false,
      created_at: null,
      updated_at: null
    };
  }

  return {
    workspace: config.workspace,
    provider: config.provider,
    base_url: config.base_url,
    model: config.model,
    temperature: config.temperature,
    system_prompt: config.system_prompt,
    enabled: config.enabled,
    has_api_key: !!config.api_key_enc,
    created_at: config.created_at,
    updated_at: config.updated_at
  };
};

export const buildAiConfigInput = (
  body: Record<string, unknown> | undefined
): UpsertAiConfigInput => {
  httpAssert.present(body, { message: 'Request body is required' });

  const input: UpsertAiConfigInput = {};

  if (body['provider'] !== undefined) {
    httpAssert.true(body['provider'] === 'openrouter' || body['provider'] === 'openai', {
      message: 'provider must be "openrouter" or "openai"'
    });
    input.provider = body['provider'] as string;
  }

  if (body['api_key'] !== undefined) {
    if (body['api_key'] === null || body['api_key'] === '') {
      input.api_key_enc = null;
    } else {
      httpAssert.string(body['api_key'], { message: 'api_key must be a non-empty string or null' });
      input.api_key_enc = encrypt(body['api_key']);
    }
  }

  if (body['model'] !== undefined) {
    if (body['model'] !== null) {
      httpAssert.string(body['model'], { message: 'model must be a string or null' });
    }
    input.model = body['model'] as string | null;
  }

  if (body['base_url'] !== undefined) {
    if (body['base_url'] !== null) {
      httpAssert.string(body['base_url'], { message: 'base_url must be a string or null' });
    }
    input.base_url = body['base_url'] as string | null;
  }

  if (body['temperature'] !== undefined) {
    if (body['temperature'] !== null) {
      httpAssert.true(
        typeof body['temperature'] === 'number' &&
          body['temperature'] >= 0 &&
          body['temperature'] <= 2,
        { message: 'temperature must be a number between 0 and 2' }
      );
    }
    input.temperature = body['temperature'] as number | null;
  }

  if (body['system_prompt'] !== undefined) {
    if (body['system_prompt'] !== null) {
      httpAssert.string(body['system_prompt'], {
        message: 'system_prompt must be a string or null'
      });
    }
    input.system_prompt = body['system_prompt'] as string | null;
  }

  if (body['enabled'] !== undefined) {
    httpAssert.boolean(body['enabled'], { message: 'enabled must be a boolean' });
    input.enabled = body['enabled'];
  }

  return input;
};

export const parseExtractResponse = (result: string) => {
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return { entities: JSON.parse(jsonMatch[0]) };
    }
    return { entities: [], raw: result };
  } catch {
    return { entities: [], raw: result };
  }
};

const wrapConversationStream = (
  stream: AsyncIterable<ChatChunk>,
  onPersist: (
    content: string,
    toolCalls: Array<{ name: string; args: string; result?: unknown }>
  ) => Promise<void>
): AsyncIterable<ChatChunk> => {
  const capturedContent: string[] = [];
  const capturedToolCalls: Array<{ name: string; args: string; result?: unknown }> = [];

  const persistAssistant = async () => {
    if (capturedContent.length === 0) return;
    await onPersist(capturedContent.join(''), capturedToolCalls);
  };

  return (async function* () {
    try {
      for await (const chunk of stream) {
        if (
          (chunk.type === 'TEXT_MESSAGE_CONTENT' || chunk.type === 'REASONING_MESSAGE_CONTENT') &&
          chunk.delta
        ) {
          capturedContent.push(chunk.delta as string);
        }
        if (chunk.type === 'TOOL_CALL_START' && chunk.toolCallName) {
          capturedToolCalls.push({
            name: chunk.toolCallName as string,
            args: '',
            result: undefined
          });
        }
        if (chunk.type === 'TOOL_CALL_ARGS' && capturedToolCalls.length > 0) {
          capturedToolCalls[capturedToolCalls.length - 1]!.args += (chunk.delta as string) ?? '';
        }
        if (chunk.type === 'TOOL_CALL_RESULT' && capturedToolCalls.length > 0) {
          capturedToolCalls[capturedToolCalls.length - 1]!.result = chunk.content;
        }
        yield chunk;
      }
      await persistAssistant();
    } catch (error) {
      const isAbort =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'));
      if (isAbort) await persistAssistant().catch(() => undefined);
      throw error;
    }
  })();
};

export const createAiChatRoutes = (db: DatabaseAdapter, deps: AiChatRouteDeps = {}) => {
  const router = new H3();
  const chatImpl = deps.chatImpl ?? chat;
  const parseChatParams = deps.chatParamsFromRequestBodyImpl ?? chatParamsFromRequestBody;
  const toSseResponse = deps.toServerSentEventsResponseImpl ?? toServerSentEventsResponse;
  const resolveAi = deps.resolveAiConfigImpl ?? resolveAiConfig;
  const createAdapter = deps.createAiTextAdapterImpl ?? createAiTextAdapter;
  const buildPrompt = deps.buildSystemPromptImpl ?? buildSystemPrompt;
  const createTools = deps.createAiChatToolsImpl ?? createAiChatTools;
  const makeId = deps.randomId ?? randomUUID;

  // POST /api/:workspace/ai/chat -- streaming chat via TanStack AI SSE
  router.post(
    `${BASE}/chat`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const aiConfig = await resolveAi(db, workspace);
      if (!aiConfig) {
        throw new HTTPError({ status: 503, message: 'AI is not configured for this workspace' });
      }

      let body: unknown;
      try {
        body = await event.req.json();
      } catch {
        throw new HTTPError({ status: 400, message: 'Invalid JSON in request body' });
      }
      httpAssert.present(body, { message: 'Request body is required' });

      const params = await parseChatParams(body);
      const systemPrompt = await buildPrompt(db, workspace, aiConfig.systemPrompt);
      const adapter = createAdapter(aiConfig);
      const abortController = new AbortController();
      const tools = createTools(db, workspace, authCtx);

      const stream = chatImpl({
        adapter,
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        messages: params.messages as any,
        systemPrompts: [systemPrompt],
        tools,
        temperature: aiConfig.temperature,
        threadId: params.threadId,
        runId: params.runId,
        abortController
      });

      const conversationId = params.forwardedProps?.['conversationId'] as string | undefined;

      if (conversationId) {
        const lastUserMsg = [...params.messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
          const textContent = extractUserTextContent(lastUserMsg);

          if (textContent) {
            await db.ai.createMessage({
              id: makeId(),
              conversation_id: conversationId,
              role: 'user',
              content: textContent,
              metadata: {},
              created_at: new Date()
            });

            await db.ai.initConversationTitle(
              workspace,
              conversationId,
              buildConversationAutoTitle(textContent)
            );
          }
        }
      }

      // Wrap stream to capture and persist the assistant message after it completes
      let wrappedStream = stream as AsyncIterable<unknown>;

      if (conversationId) {
        wrappedStream = wrapConversationStream(
          stream as AsyncIterable<ChatChunk>,
          async (content, toolCalls) => {
            const metadata: Record<string, unknown> = {};
            if (toolCalls.length > 0) metadata.toolCalls = toolCalls;
            await db.ai.createMessage({
              id: makeId(),
              conversation_id: conversationId,
              role: 'assistant',
              content,
              metadata,
              created_at: new Date()
            });
          }
        );
      }

      // biome-ignore lint/suspicious/noExplicitAny: false positive
      return toSseResponse(wrappedStream as any, { abortController });
    })
  );

  // GET /api/:workspace/ai/conversations
  router.get(
    `${BASE}/conversations`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      const user = (event as AuthenticatedEvent).context.user;
      return await db.ai.listConversations(workspace, user.id);
    })
  );

  // POST /api/:workspace/ai/conversations
  router.post(
    `${BASE}/conversations`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      const user = (event as AuthenticatedEvent).context.user;

      const body = (await event.req.json().catch(() => undefined)) as
        | { title?: unknown }
        | undefined;
      const title =
        typeof body?.title === 'string' && body.title.length > 0 ? body.title : 'New conversation';

      const now = new Date();
      return await db.ai.createConversation({
        id: makeId(),
        workspace,
        user_id: user.id,
        title,
        created_at: now,
        updated_at: now
      });
    })
  );

  // PATCH /api/:workspace/ai/conversations/:conversationId
  router.patch(
    `${BASE}/conversations/:conversationId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const conversationId = event.context.params?.['conversationId'];
      httpAssert.string(conversationId, { message: 'conversationId is required' });

      const conversation = await db.ai.getConversation(workspace, conversationId);
      httpAssert.present(conversation, { status: 404, message: 'Conversation not found' });

      const user = (event as AuthenticatedEvent).context.user;
      httpAssert.true(conversation.user_id === user.id, {
        status: 403,
        message: "Cannot modify another user's conversation"
      });

      const body = (await event.req.json().catch(() => undefined)) as
        | { title?: unknown }
        | undefined;
      httpAssert.present(body, { message: 'Request body is required' });

      const title = body.title;
      httpAssert.string(title, { message: 'title is required' });

      const updated = await db.ai.updateConversationTitle(workspace, conversationId, title);
      httpAssert.present(updated, { status: 404, message: 'Conversation not found' });
      return updated;
    })
  );

  // DELETE /api/:workspace/ai/conversations/:conversationId
  router.delete(
    `${BASE}/conversations/:conversationId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const conversationId = event.context.params?.['conversationId'];
      httpAssert.string(conversationId, { message: 'conversationId is required' });

      const conversation = await db.ai.getConversation(workspace, conversationId);
      httpAssert.present(conversation, { status: 404, message: 'Conversation not found' });

      const user = (event as AuthenticatedEvent).context.user;
      httpAssert.true(conversation.user_id === user.id, {
        status: 403,
        message: "Cannot delete another user's conversation"
      });

      const deleted = await db.ai.deleteConversation(workspace, conversationId);
      httpAssert.present(deleted, { status: 404, message: 'Conversation not found' });
      return deleted;
    })
  );

  // GET /api/:workspace/ai/conversations/:conversationId/messages
  router.get(
    `${BASE}/conversations/:conversationId/messages`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const conversationId = event.context.params?.['conversationId'];
      httpAssert.string(conversationId, { message: 'conversationId is required' });

      const conversation = await db.ai.getConversation(workspace, conversationId);
      httpAssert.present(conversation, { status: 404, message: 'Conversation not found' });

      const user = (event as AuthenticatedEvent).context.user;
      httpAssert.true(conversation.user_id === user.id, {
        status: 403,
        message: "Cannot access another user's conversation"
      });

      return await db.ai.listMessages(conversationId);
    })
  );

  // GET /api/:workspace/ai/config
  router.get(
    `${BASE}/config`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.settings');

      const config = await db.ai.getAiConfig(workspace);
      return createAiConfigResponse(workspace, config);
    })
  );

  // PUT /api/:workspace/ai/config
  router.put(
    `${BASE}/config`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.settings');

      const body = (await event.req.json().catch(() => undefined)) as
        | Record<string, unknown>
        | undefined;
      const input = buildAiConfigInput(body);

      const config = await db.ai.upsertAiConfig(workspace, input);
      return createAiConfigResponse(workspace, config);
    })
  );

  // POST /api/:workspace/ai/extract -- entity extraction from text
  router.post(
    `${BASE}/extract`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const aiConfig = await resolveAi(db, workspace);
      if (!aiConfig) {
        throw new HTTPError({ status: 503, message: 'AI is not configured for this workspace' });
      }

      const body = (await event.req.json().catch(() => undefined)) as
        | { text?: unknown }
        | undefined;
      httpAssert.present(body, { message: 'Request body is required' });
      httpAssert.string(body.text, { message: 'text is required' });

      const schemas = await db.catalog.listSchemas(workspace);
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
      const result = await chatImpl({
        adapter,
        messages: [{ role: 'user', content: body.text }],
        systemPrompts: [extractPrompt],
        temperature: 0.3,
        stream: false
      });

      return parseExtractResponse(result as string);
    })
  );

  return router;
};
