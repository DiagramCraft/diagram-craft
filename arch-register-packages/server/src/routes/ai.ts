import { defineHandler, EventHandlerRequest, H3, H3Event, HTTPError } from 'h3';
import type { AIGenerateRequest, AIServer } from '../ai/aiServer.js';
import { httpAssert } from '../utils/httpAssert.js';

// Constants
const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB limit for AI requests
const CONTENT_TYPE_JSON = 'application/json';
const API_AI_PATH = '/api/ai';

export const createAIRoutes = (aiServer: AIServer) => {
  const router = new H3();

  // Helper function to validate content type and size
  const validateRequest = (event: H3Event<EventHandlerRequest>) => {
    const contentTypeStr = event.req.headers.get('content-type');
    if (contentTypeStr && !contentTypeStr.startsWith(CONTENT_TYPE_JSON)) {
      throw new HTTPError({
        status: 415,
        statusText: 'Unsupported Media Type',
        message: `Content-Type must be ${CONTENT_TYPE_JSON}`
      });
    }

    const contentLengthStr = event.req.headers.get('content-length');
    const contentLength = parseInt(contentLengthStr ?? '0', 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      throw new HTTPError({
        status: 413,
        statusText: 'Payload Too Large',
        message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes`
      });
    }
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
          message: 'OpenRouter request timed out'
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

  // POST /api/ai/generate - Proxy to OpenRouter
  router.post(
    `${API_AI_PATH}/generate`,
    defineHandler(async event => {
      validateRequest(event);

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

        // Prepare OpenRouter request
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
