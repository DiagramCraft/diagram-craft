import { newid } from '@diagram-craft/utils/id';
import { H3, defineHandler, HTTPError } from 'h3';
import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from '@tanstack/ai';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';
import { encrypt } from '../utils/encryption.js';
import { resolveAiConfig, createAiTextAdapter } from '../ai/tanstackAiAdapter.js';
import { buildSystemPrompt } from '../ai/systemPromptBuilder.js';
import { createAiChatTools } from '../ai/chatTools.js';

const BASE = '/api/:workspace/ai';

export const createAiChatRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  // POST /api/:workspace/ai/chat -- streaming chat via TanStack AI SSE
  router.post(
    `${BASE}/chat`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const aiConfig = await resolveAiConfig(db, workspace);
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

      const params = await chatParamsFromRequestBody(body);
      const systemPrompt = await buildSystemPrompt(db, workspace, aiConfig.systemPrompt);
      const adapter = createAiTextAdapter(aiConfig);
      const abortController = new AbortController();
      const tools = createAiChatTools(db, workspace, authCtx);

      const stream = chat({
        adapter,
        messages: params.messages,
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
          let textContent = '';
          if ('parts' in lastUserMsg) {
            textContent = (lastUserMsg.parts as Array<{ type: string; content?: string }>)
              .filter(p => p.type === 'text')
              .map(p => p.content ?? '')
              .join('');
          } else if ('content' in lastUserMsg) {
            const c = lastUserMsg.content;
            textContent = typeof c === 'string'
              ? c
              : Array.isArray(c)
                ? (c as Array<{ type: string; content?: string }>).filter(p => p.type === 'text').map(p => p.content ?? '').join('')
                : '';
          }

          if (textContent) {
            await db.ai.createMessage({
              id: newid(),
              conversation_id: conversationId,
              role: 'user',
              content: textContent,
              metadata: {},
              created_at: new Date()
            });

            const autoTitle = textContent.length > 50
              ? `${textContent.substring(0, 47)}...`
              : textContent;
            await db.ai.initConversationTitle(workspace, conversationId, autoTitle);
          }
        }
      }

      // Wrap stream to capture and persist the assistant message after it completes
      let wrappedStream = stream;

      if (conversationId) {
        const capturedContent: string[] = [];
        const capturedToolCalls: Array<{ name: string; args: string; result?: unknown }> = [];

        const persistAssistant = async () => {
          if (capturedContent.length === 0) return;
          const content = capturedContent.join('');
          const metadata: Record<string, unknown> = {};
          if (capturedToolCalls.length > 0) metadata.toolCalls = capturedToolCalls;
          await db.ai.createMessage({
            id: newid(),
            conversation_id: conversationId,
            role: 'assistant',
            content,
            metadata,
            created_at: new Date()
          });
        };

        wrappedStream = (async function* () {
          try {
            for await (const chunk of stream) {
              if ((chunk.type === 'TEXT_MESSAGE_CONTENT' || chunk.type === 'REASONING_MESSAGE_CONTENT') && 'delta' in chunk && chunk.delta) {
                capturedContent.push(chunk.delta as string);
              }
              if (chunk.type === 'TOOL_CALL_START' && 'toolCallName' in chunk && chunk.toolCallName) {
                capturedToolCalls.push({ name: chunk.toolCallName as string, args: '', result: undefined });
              }
              if (chunk.type === 'TOOL_CALL_ARGS' && 'delta' in chunk && capturedToolCalls.length > 0) {
                capturedToolCalls[capturedToolCalls.length - 1]!.args += (chunk.delta as string ?? '');
              }
              if (chunk.type === 'TOOL_CALL_RESULT' && 'content' in chunk && capturedToolCalls.length > 0) {
                capturedToolCalls[capturedToolCalls.length - 1]!.result = chunk.content;
              }
              yield chunk;
            }
            await persistAssistant();
          } catch (error) {
            const isAbort = error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'));
            if (isAbort) await persistAssistant().catch(() => undefined);
            throw error;
          }
        })();
      }

      return toServerSentEventsResponse(wrappedStream, { abortController });
    })
  );

  // GET /api/:workspace/ai/conversations
  router.get(
    `${BASE}/conversations`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      const user = (event as AuthenticatedEvent).context.user;

      const body = (await event.req.json().catch(() => undefined)) as { title?: unknown } | undefined;
      const title = typeof body?.title === 'string' && body.title.length > 0
        ? body.title
        : 'New conversation';

      const now = new Date();
      return await db.ai.createConversation({
        id: newid(),
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const conversationId = event.context.params?.['conversationId'];
      httpAssert.string(conversationId, { message: 'conversationId is required' });

      const conversation = await db.ai.getConversation(workspace, conversationId);
      httpAssert.present(conversation, { status: 404, message: 'Conversation not found' });

      const user = (event as AuthenticatedEvent).context.user;
      httpAssert.true(conversation.user_id === user.id, {
        status: 403,
        message: 'Cannot modify another user\'s conversation'
      });

      const body = (await event.req.json().catch(() => undefined)) as { title?: unknown } | undefined;
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const conversationId = event.context.params?.['conversationId'];
      httpAssert.string(conversationId, { message: 'conversationId is required' });

      const conversation = await db.ai.getConversation(workspace, conversationId);
      httpAssert.present(conversation, { status: 404, message: 'Conversation not found' });

      const user = (event as AuthenticatedEvent).context.user;
      httpAssert.true(conversation.user_id === user.id, {
        status: 403,
        message: 'Cannot delete another user\'s conversation'
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const conversationId = event.context.params?.['conversationId'];
      httpAssert.string(conversationId, { message: 'conversationId is required' });

      const conversation = await db.ai.getConversation(workspace, conversationId);
      httpAssert.present(conversation, { status: 404, message: 'Conversation not found' });

      const user = (event as AuthenticatedEvent).context.user;
      httpAssert.true(conversation.user_id === user.id, {
        status: 403,
        message: 'Cannot access another user\'s conversation'
      });

      return await db.ai.listMessages(conversationId);
    })
  );

  // GET /api/:workspace/ai/config
  router.get(
    `${BASE}/config`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.settings');

      const config = await db.ai.getAiConfig(workspace);
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
    })
  );

  // PUT /api/:workspace/ai/config
  router.put(
    `${BASE}/config`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.settings');

      const body = (await event.req.json().catch(() => undefined)) as Record<string, unknown> | undefined;
      httpAssert.present(body, { message: 'Request body is required' });

      const input: Parameters<typeof db.ai.upsertAiConfig>[1] = {};

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
            typeof body['temperature'] === 'number' && body['temperature'] >= 0 && body['temperature'] <= 2,
            { message: 'temperature must be a number between 0 and 2' }
          );
        }
        input.temperature = body['temperature'] as number | null;
      }

      if (body['system_prompt'] !== undefined) {
        if (body['system_prompt'] !== null) {
          httpAssert.string(body['system_prompt'], { message: 'system_prompt must be a string or null' });
        }
        input.system_prompt = body['system_prompt'] as string | null;
      }

      if (body['enabled'] !== undefined) {
        httpAssert.boolean(body['enabled'], { message: 'enabled must be a boolean' });
        input.enabled = body['enabled'];
      }

      const config = await db.ai.upsertAiConfig(workspace, input);

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
    })
  );

  // POST /api/:workspace/ai/extract -- entity extraction from text
  router.post(
    `${BASE}/extract`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');

      const aiConfig = await resolveAiConfig(db, workspace);
      if (!aiConfig) {
        throw new HTTPError({ status: 503, message: 'AI is not configured for this workspace' });
      }

      const body = (await event.req.json().catch(() => undefined)) as { text?: unknown } | undefined;
      httpAssert.present(body, { message: 'Request body is required' });
      httpAssert.string(body.text, { message: 'text is required' });

      const schemas = await db.catalog.listSchemas(workspace);
      const schemaDescriptions = schemas.map(s => {
        const fields = s.fields.map(f => `${f.name} (${f.type})`).join(', ');
        return `- ${s.name} (id: ${s.id}): fields: ${fields}`;
      }).join('\n');

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

      const adapter = createAiTextAdapter(aiConfig);
      const result = await chat({
        adapter,
        messages: [{ role: 'user', content: body.text }],
        systemPrompts: [extractPrompt],
        temperature: 0.3,
        stream: false
      });

      // Try to parse the JSON from the response
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return { entities: JSON.parse(jsonMatch[0]) };
        }
        return { entities: [], raw: result };
      } catch {
        return { entities: [], raw: result };
      }
    })
  );

  return router;
};
