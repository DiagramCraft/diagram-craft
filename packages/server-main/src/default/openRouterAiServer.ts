import { HTTPError } from 'h3';
import type {
  AIGenerateRequest,
  AIResult,
  AIServer,
  AIMessage
} from '../aiServer';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT = 120000;
const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

type AIConfig = {
  apiKey: string;
  defaultModel?: string;
  siteUrl?: string;
  appName?: string;
};

type OpenRouterRequest = {
  model: string;
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};

export class OpenRouterAIServer implements AIServer {
  constructor(private readonly config: AIConfig) {}

  async generate(request: AIGenerateRequest): Promise<AIResult> {
    const openRouterRequest: OpenRouterRequest = {
      model: this.config.defaultModel ?? DEFAULT_MODEL,
      messages: request.messages,
      stream: request.stream ?? true,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens
    };

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': this.config.siteUrl ?? 'http://localhost',
          'X-Title': this.config.appName ?? 'DiagramCraft'
        },
        body: JSON.stringify(openRouterRequest),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = 'OpenRouter API error';

        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.error?.message ?? errorMessage;
        } catch {
          // Ignore invalid JSON error bodies and keep the default message.
        }

        throw new HTTPError({
          status: response.status,
          statusText: response.statusText,
          message: errorMessage
        });
      }

      if (request.stream ?? true) {
        if (response.body === null) {
          throw new Error('OpenRouter returned an empty streaming response');
        }

        return {
          type: 'stream',
          body: response.body
        };
      }

      return {
        type: 'json',
        body: await response.json()
      };
    } catch (error) {
      if (HTTPError.isError(error)) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new HTTPError({
          status: 504,
          statusText: 'Gateway Timeout',
          message: 'OpenRouter request timed out'
        });
      }

      if (error instanceof Error) {
        throw new HTTPError({
          status: 500,
          statusText: 'Internal Server Error',
          message: `Failed to generate AI response: ${error.message}`
        });
      }

      throw new HTTPError({
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Failed to generate AI response'
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
