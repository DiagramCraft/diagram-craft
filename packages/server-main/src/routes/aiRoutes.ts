import {
  createError,
  createRouter,
  defineEventHandler,
  EventHandlerRequest,
  getRequestHeader,
  H3Event,
  readBody,
  setResponseHeader
} from 'h3';
import type { AIGenerateRequest, AIServer } from '../aiServer';

// Constants
const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB limit for AI requests
const CONTENT_TYPE_JSON = 'application/json';
const API_AI_PATH = '/api/ai';

export function createAIRoutes(aiServer: AIServer) {
  const router = createRouter();

  // Helper function to validate content type and size
  const validateRequest = (event: H3Event<EventHandlerRequest>) => {
    const contentTypeStr = getRequestHeader(event, 'content-type');
    if (contentTypeStr && !contentTypeStr.startsWith(CONTENT_TYPE_JSON)) {
      throw createError({
        status: 415,
        statusMessage: 'Unsupported Media Type',
        data: { message: `Content-Type must be ${CONTENT_TYPE_JSON}` }
      });
    }

    const contentLengthStr = getRequestHeader(event, 'content-length');
    const contentLength = parseInt(contentLengthStr ?? '0', 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      throw createError({
        status: 413,
        statusMessage: 'Payload Too Large',
        data: { message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes` }
      });
    }
  };

  // Helper function to handle errors consistently
  const handleError = (error: unknown, fallbackMessage: string) => {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    // Handle fetch errors
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw createError({
          status: 504,
          statusMessage: 'Gateway Timeout',
          data: { message: 'OpenRouter request timed out' }
        });
      }

      // Pass through detailed error message for debugging
      throw createError({
        status: 500,
        statusMessage: 'Internal Server Error',
        data: { message: `${fallbackMessage}: ${error.message}` }
      });
    }

    throw createError({
      status: 500,
      statusMessage: 'Internal Server Error',
      data: { message: fallbackMessage }
    });
  };

  // POST /api/ai/generate - Proxy to OpenRouter
  router.post(
    `${API_AI_PATH}/generate`,
    defineEventHandler(async event => {
      validateRequest(event);

      try {
        const body = (await readBody(event)) as AIGenerateRequest;

        // Validate request body
        if (!body || typeof body !== 'object') {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'Request body must be a valid JSON object' }
          });
        }

        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'messages array is required and must not be empty' }
          });
        }

        // Validate message structure
        for (const message of body.messages) {
          if (!message.role || !message.content) {
            throw createError({
              status: 400,
              statusMessage: 'Bad Request',
              data: { message: 'Each message must have role and content properties' }
            });
          }
          if (!['system', 'user', 'assistant'].includes(message.role)) {
            throw createError({
              status: 400,
              statusMessage: 'Bad Request',
              data: { message: 'Message role must be system, user, or assistant' }
            });
          }
        }

        // Prepare OpenRouter request
        const result = await aiServer.generate(body);

        if (result.type === 'stream') {
          setResponseHeader(event, 'Content-Type', 'text/event-stream');
          setResponseHeader(event, 'Cache-Control', 'no-cache');
          setResponseHeader(event, 'Connection', 'keep-alive');
          return result.body;
        }

        return result.body;
      } catch (error: unknown) {
        handleError(error, 'Failed to generate AI response');
      }
    })
  );

  return router;
}
