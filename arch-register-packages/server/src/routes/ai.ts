import { defineHandler, EventHandlerRequest, H3, H3Event, HTTPError } from 'h3';
import type { AIGenerateRequest } from '../ai/aiServer.js';
import { httpAssert } from '../utils/httpAssert.js';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveAiConfig } from '../ai/tanstackAiAdapter.js';
import { ConfiguredAIServer } from '../ai/configuredAiServer.js';

// Constants
const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB limit for AI requests
const CONTENT_TYPE_JSON = 'application/json';
const API_AI_PATH = '/api/:workspace/ai';

export const createAIRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  // Helper function to validate content type and size
  const validateRequest = (event: H3Event<EventHandlerRequest>) => {
    const contentTypeStr = event.req.headers.get('content-type');
    httpAssert.true(contentTypeStr?.startsWith(CONTENT_TYPE_JSON), {
      status: 415,
      statusText: 'Unsupported Media Type',
      message: `Content-Type must be ${CONTENT_TYPE_JSON}`
    });

    const contentLengthStr = event.req.headers.get('content-length');
    const contentLength = parseInt(contentLengthStr ?? '0', 10);
    httpAssert.true(contentLength <= MAX_REQUEST_SIZE, {
      status: 413,
      statusText: 'Payload Too Large',
      message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes`
    });
  };

  // Helper function to handle errors consistently
  const handleError = (error: unknown, fallbackMessage: string) => {
    if (HTTPError.isError(error)) {
      throw error;
    }

    // Handle fetch errors
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new HTTPError({
          status: 504,
          statusText: 'Gateway Timeout',
          message: 'AI request timed out'
        });
      }

      // Pass through detailed error message for debugging
      throw new HTTPError({
        status: 500,
        statusText: 'Internal Server Error',
        message: `${fallbackMessage}: ${error.message}`
      });
    }

    throw new HTTPError({
      status: 500,
      statusText: 'Internal Server Error',
      message: fallbackMessage
    });
  };

  // POST /api/:workspace/ai/generate
  router.post(
    `${API_AI_PATH}/generate`,
    defineHandler(async event => {
      validateRequest(event);

      const workspace = event.context.params?.['workspace'];
      httpAssert.string(workspace, { status: 400, message: 'workspace is required' });

      const aiConfig = await resolveAiConfig(db, workspace);
      if (!aiConfig) {
        throw new HTTPError({ status: 503, message: 'AI is not configured for this workspace' });
      }

      try {
        const body = (await event.req.json().catch(() => undefined)) as
          | AIGenerateRequest
          | undefined;

        // Validate request body
        httpAssert.json(body, { message: 'Request body must be a valid JSON object' });

        httpAssert.true(Array.isArray(body.messages) && body.messages.length > 0, {
          message: 'messages array is required and must not be empty'
        });

        // Validate message structure
        for (const message of body.messages) {
          httpAssert.present(message.role, { message: 'Each message must have role' });
          httpAssert.present(message.content, { message: 'Each message must have content' });
          httpAssert.true(['system', 'user', 'assistant'].includes(message.role), {
            message: 'Message role must be system, user, or assistant'
          });
        }

        const aiServer = new ConfiguredAIServer(aiConfig);
        const result = await aiServer.generate(body);

        if (result.type === 'stream') {
          event.res.headers.set('Content-Type', 'text/event-stream');
          event.res.headers.set('Cache-Control', 'no-cache');
          event.res.headers.set('Connection', 'keep-alive');
          return result.body;
        }

        return result.body;
      } catch (error: unknown) {
        handleError(error, 'Failed to generate AI response');
      }
    })
  );

  return router;
};
