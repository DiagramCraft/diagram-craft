import { HTTPError } from 'h3';
import type { AIGenerateRequest, AIResult, AIServer, AIMessage } from './aiServer';
import { httpAssert } from '../utils/httpAssert';
import type { EffectiveAiConfig } from './tanstackAiAdapter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT = 120000;

type ProviderRequest = {
  model: string;
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};

export class ConfiguredAIServer implements AIServer {
  constructor(private readonly config: EffectiveAiConfig) {}

  async generate(request: AIGenerateRequest): Promise<AIResult> {
    const providerRequest: ProviderRequest = {
      model: this.config.model,
      messages: request.messages,
      stream: request.stream ?? true,
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.max_tokens
    };

    const isOpenAI = this.config.provider === 'openai';
    const url = isOpenAI ? (this.config.baseUrl ?? OPENAI_API_URL) : OPENROUTER_API_URL;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };

    if (!isOpenAI) {
      headers['HTTP-Referer'] = 'http://localhost';
      headers['X-Title'] = 'ArchRegister';
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(providerRequest),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `${isOpenAI ? 'OpenAI' : 'OpenRouter'} API error`;

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
        httpAssert.present(response.body, {
          message: 'AI provider returned an empty streaming response'
        });

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
          message: 'AI request timed out'
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
