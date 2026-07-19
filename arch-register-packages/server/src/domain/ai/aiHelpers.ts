import type { AiConfigDbResult } from './db/aiDatabase';
import { WorkspaceAiConfig } from '@arch-register/api-types/aiContract';
import type { AiConfigInputDbUpsert } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { encrypt } from '../../utils/encryption';

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
    if (body['model'] === null || body['model'] === '') {
      input.model = null;
    } else {
      httpAssert.string(body['model'], { message: 'model must be a string or null' });
      input.model = body['model'] as string;
    }
  }

  if (body['base_url'] !== undefined) {
    if (body['base_url'] === null || body['base_url'] === '') {
      input.base_url = null;
    } else {
      httpAssert.string(body['base_url'], { message: 'base_url must be a string or null' });
      input.base_url = body['base_url'] as string;
    }
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
    if (body['system_prompt'] === null || body['system_prompt'] === '') {
      input.system_prompt = null;
    } else {
      httpAssert.string(body['system_prompt'], {
        message: 'system_prompt must be a string or null'
      });
      input.system_prompt = body['system_prompt'] as string;
    }
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
