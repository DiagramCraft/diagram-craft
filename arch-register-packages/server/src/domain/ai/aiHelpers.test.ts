import { describe, expect, it } from 'vitest';
import {
  buildAiConfigInput,
  buildConversationAutoTitle,
  createAiConfigResponse,
  extractUserTextContent,
  parseExtractResponse
} from './aiHelpers';
import { AiConfigDbResult } from './db/aiDatabase';

const now = new Date('2026-06-07T10:00:00.000Z');

const config: AiConfigDbResult = {
  workspace: 'default',
  provider: 'openai',
  api_key_enc: 'encrypted-key',
  base_url: 'http://localhost:1234/v1',
  model: 'gpt-test',
  temperature: 0.3,
  system_prompt: 'Be concise',
  enabled: true,
  created_at: now,
  updated_at: now
};

describe('ai chat route helpers', () => {
  it('extracts text content from string, array, and parts-based messages', () => {
    expect(extractUserTextContent({ content: 'hello world' })).toBe('hello world');
    expect(
      extractUserTextContent({
        content: [
          { type: 'text', content: 'hello ' },
          { type: 'image', content: 'ignored' },
          { type: 'text', content: 'world' }
        ]
      })
    ).toBe('hello world');
    expect(
      extractUserTextContent({
        parts: [
          { type: 'text', content: 'part 1 ' },
          { type: 'tool-call', content: 'ignored' },
          { type: 'text', content: 'part 2' }
        ]
      })
    ).toBe('part 1 part 2');
  });

  it('builds conversation auto titles with truncation', () => {
    expect(buildConversationAutoTitle('Short title')).toBe('Short title');
    expect(
      buildConversationAutoTitle(
        'This is a deliberately long conversation title that should truncate'
      )
    ).toBe('This is a deliberately long conversation title ...');
  });

  it('shapes AI config responses and default empty config responses', () => {
    expect(createAiConfigResponse(config)).toEqual({
      workspace: 'default',
      provider: 'openai',
      base_url: 'http://localhost:1234/v1',
      model: 'gpt-test',
      temperature: 0.3,
      system_prompt: 'Be concise',
      enabled: true,
      has_api_key: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    });
  });

  it('builds AI config update inputs from validated request bodies', () => {
    expect(
      buildAiConfigInput({
        provider: 'openai',
        api_key: 'plain-key',
        model: 'gpt-4.1',
        base_url: 'http://localhost:9999/v1',
        temperature: 0.6,
        system_prompt: 'Focus on architecture.',
        enabled: true
      })
    ).toEqual({
      provider: 'openai',
      api_key_enc: 'plain-key',
      model: 'gpt-4.1',
      base_url: 'http://localhost:9999/v1',
      temperature: 0.6,
      system_prompt: 'Focus on architecture.',
      enabled: true
    });

    expect(buildAiConfigInput({ api_key: '' })).toEqual({ api_key_enc: null });
  });

  it('rejects invalid AI config inputs', () => {
    expect(() => buildAiConfigInput(undefined)).toThrowError('Request body is required');
    expect(() => buildAiConfigInput({ provider: 'other' })).toThrowError(
      'provider must be "openrouter" or "openai"'
    );
    expect(() => buildAiConfigInput({ temperature: 3 })).toThrowError(
      'temperature must be a number between 0 and 2'
    );
    expect(() => buildAiConfigInput({ enabled: 'yes' })).toThrowError('enabled must be a boolean');
  });

  it('parses extraction responses and falls back to raw output', () => {
    expect(
      parseExtractResponse('prefix [{"name":"Billing API","schema_id":"schema-api"}] suffix')
    ).toEqual({
      entities: [{ name: 'Billing API', schema_id: 'schema-api' }]
    });
    expect(parseExtractResponse('not json')).toEqual({
      entities: [],
      raw: 'not json'
    });
  });
});
