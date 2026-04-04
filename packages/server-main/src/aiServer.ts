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

export type AIStreamResult = {
  type: 'stream';
  body: ReadableStream<Uint8Array>;
};

export type AIJsonResult = {
  type: 'json';
  body: unknown;
};

export type AIResult = AIStreamResult | AIJsonResult;

export interface AIServer {
  generate(request: AIGenerateRequest): Promise<AIResult>;
}
