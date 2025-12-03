// AI Service for interacting with the OpenRouter proxy

import { AppConfig } from '../../appConfig';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerateRequest {
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface AIGenerateResponse {
  id: string;
  model: string;
  choices: Array<{
    message: AIMessage;
    finish_reason: string;
  }>;
}

export interface AIConfig {
  defaultModel: string;
  hasApiKey: boolean;
  appName?: string;
  siteUrl?: string;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

export class AIService {
  private baseUrl: string;
  private fetchTimeout: number = 120000; // 2 minutes for AI requests

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if AI features are available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      return config.hasApiKey;
    } catch {
      return false;
    }
  }

  /**
   * Get current AI configuration
   */
  async getConfig(): Promise<AIConfig> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/ai/config`);

    if (!response.ok) {
      throw new Error(`Failed to get AI config: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate AI response with streaming support
   */
  async generate(
    request: AIGenerateRequest,
    onChunk?: (chunk: AIStreamChunk) => void
  ): Promise<AIGenerateResponse> {
    const shouldStream = request.stream ?? true;

    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        temperature: 0.7,
        ...request,
        stream: shouldStream
      })
    });

    if (!response.ok) {
      let errorMessage = `AI generation failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parsing errors
      }
      throw new Error(errorMessage);
    }

    if (shouldStream && onChunk) {
      return this.handleStreamingResponse(response, onChunk);
    } else {
      return response.json();
    }
  }

  /**
   * Handle streaming response from server
   */
  private async handleStreamingResponse(
    response: Response,
    onChunk: (chunk: AIStreamChunk) => void
  ): Promise<AIGenerateResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let accumulatedContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') {
            onChunk({ content: '', done: true });
            break;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content ?? '';

            if (content) {
              accumulatedContent += content;
              onChunk({ content, done: false });
            }
          } catch (e) {
            console.warn('Failed to parse streaming chunk:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Return a mock response for streaming
    return {
      id: 'stream-response',
      model: 'streaming',
      choices: [
        {
          message: {
            role: 'assistant',
            content: accumulatedContent
          },
          finish_reason: 'stop'
        }
      ]
    };
  }

  /**
   * Fetch with timeout using AbortController
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get available models from OpenRouter
   */
  async getModels(): Promise<any> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/ai/models`);

    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.statusText}`);
    }

    return response.json();
  }
}

// Singleton instance
export const aiService = new AIService(AppConfig.get().ai.endpoint);
