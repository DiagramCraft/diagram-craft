import {
  createError,
  createRouter,
  defineEventHandler,
  EventHandlerRequest,
  H3Event,
  readBody,
  setResponseHeader
} from 'h3';

// Constants
const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB limit for AI requests
const CONTENT_TYPE_JSON = 'application/json';
const API_AI_PATH = '/api/ai';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT = 120000; // 120 seconds for AI responses

// Type definitions
export interface AIConfig {
  apiKey: string;
  defaultModel?: string;
  siteUrl?: string;
  appName?: string;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerateRequest {
  messages: OpenRouterMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export function createAIRoutes(config: AIConfig) {
  const router = createRouter();

  // Helper function to validate content type and size
  const validateRequest = (event: H3Event<EventHandlerRequest>) => {
    const contentType = event.node.req.headers['content-type'];
    const contentTypeStr = Array.isArray(contentType) ? contentType[0] : contentType;
    if (contentTypeStr && !contentTypeStr.startsWith(CONTENT_TYPE_JSON)) {
      throw createError({
        status: 415,
        statusMessage: 'Unsupported Media Type',
        data: { message: `Content-Type must be ${CONTENT_TYPE_JSON}` }
      });
    }

    const contentLengthHeader = event.node.req.headers['content-length'];
    const contentLengthStr = Array.isArray(contentLengthHeader)
      ? contentLengthHeader[0]
      : contentLengthHeader;
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
        const openRouterRequest: OpenRouterRequest = {
          model: config.defaultModel ?? 'anthropic/claude-3.5-sonnet',
          messages: body.messages,
          stream: body.stream ?? true,
          temperature: body.temperature ?? 0.7,
          max_tokens: body.max_tokens
        };

        // Set up abort controller for timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);

        try {
          // Make request to OpenRouter
          const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
              'HTTP-Referer': config.siteUrl ?? 'http://localhost',
              'X-Title': config.appName ?? 'DiagramCraft'
            },
            body: JSON.stringify(openRouterRequest),
            signal: abortController.signal
          });

          clearTimeout(timeoutId);

          // Handle non-OK responses
          if (!response.ok) {
            const errorBody = await response.text();
            let errorMessage = 'OpenRouter API error';

            try {
              const errorJson = JSON.parse(errorBody);
              errorMessage = errorJson.error?.message ?? errorMessage;
            } catch {
              // If parsing fails, use default message
            }

            throw createError({
              status: response.status,
              statusMessage: response.statusText,
              data: { message: errorMessage }
            });
          }

          // Handle streaming response
          if (body.stream ?? true) {
            // Set headers for SSE streaming
            setResponseHeader(event, 'Content-Type', 'text/event-stream');
            setResponseHeader(event, 'Cache-Control', 'no-cache');
            setResponseHeader(event, 'Connection', 'keep-alive');

            // Return the readable stream directly
            // H3 will handle piping it to the response
            return response.body;
          } else {
            // Non-streaming response
            const data = await response.json();
            return data;
          }
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } catch (error: unknown) {
        handleError(error, 'Failed to generate AI response');
      }
    })
  );

  // GET /api/ai/models - Get available models (optional endpoint)
  router.get(
    `${API_AI_PATH}/models`,
    defineEventHandler(async _event => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            Authorization: `Bearer ${config.apiKey}`
          }
        });

        if (!response.ok) {
          throw createError({
            status: response.status,
            statusMessage: response.statusText,
            data: { message: 'Failed to fetch models from OpenRouter' }
          });
        }

        return response.json();
      } catch (error: unknown) {
        handleError(error, 'Failed to fetch available models');
      }
    })
  );

  // GET /api/ai/config - Get current AI configuration (without sensitive data)
  router.get(
    `${API_AI_PATH}/config`,
    defineEventHandler(async _event => {
      return {
        defaultModel: config.defaultModel ?? 'anthropic/claude-3.5-sonnet',
        hasApiKey: !!config.apiKey,
        appName: config.appName ?? 'DiagramCraft',
        siteUrl: config.siteUrl ?? 'http://localhost'
      };
    })
  );

  return router;
}
