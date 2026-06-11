import { randomUUID } from 'node:crypto';
import { H3, defineHandler, HTTPError } from 'h3';
import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from '@tanstack/ai';
import type { DatabaseAdapter } from '../../db/database';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { resolveAiConfig, createAiTextAdapter } from './tanstackAiAdapter';
import { buildSystemPrompt } from './systemPromptBuilder';
import { createAiChatTools } from './chatTools';
import { encrypt } from '../../utils/encryption';
import type { AiConfigInputDbUpsert } from '../../db/database';
import type { AiConfigDbResult } from './db/aiDatabase';
import { WorkspaceAiConfig } from '@arch-register/api-types/aiContract';

// REST route base for AI chat endpoints
const ROUTE_BASE = '/:workspace/ai';

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

export const createAiConfigResponse = (config: AiConfigDbResult): WorkspaceAiConfig => {
  return {
    workspace: config.workspace,
    provider: config.provider,
    base_url: config.base_url,
    model: config.model,
    temperature: config.temperature,
    system_prompt: config.system_prompt,
    enabled: config.enabled,
    has_api_key: !!config.api_key_enc,
    created_at:
      config.created_at instanceof Date ? config.created_at.toISOString() : config.created_at,
    updated_at:
      config.updated_at instanceof Date ? config.updated_at.toISOString() : config.updated_at
  };
};

export const buildAiConfigInput = (
  body: Record<string, unknown> | undefined
): AiConfigInputDbUpsert => {
  httpAssert.present(body, { message: 'Request body is required' });

  const input: AiConfigInputDbUpsert = {};

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
    `${ROUTE_BASE}/chat`,
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
      const user = (event as AuthenticatedEvent).context.user;
      const tools = createTools(db, workspace, authCtx, {
        id: user.id,
        displayName: user.display_name
      });

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

  return router;
};
