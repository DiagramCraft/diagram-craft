import { describe, expect, it } from 'vitest';
import { HTTPError } from 'h3';
import {
  toAIHttpError,
  validateAIGenerateBody,
  validateAIRequestHeaders
} from './ai.js';

const makeEvent = (headers: Record<string, string>) =>
  ({
    req: {
      headers: new Headers(headers)
    }
  }) as never;

describe('ai route helpers', () => {
  it('accepts JSON requests within the size limit', () => {
    expect(() =>
      validateAIRequestHeaders(
        makeEvent({
          'content-type': 'application/json; charset=utf-8',
          'content-length': '128'
        })
      )
    ).not.toThrow();
  });

  it('rejects unsupported content types and oversized requests', () => {
    expect(() =>
      validateAIRequestHeaders(
        makeEvent({
          'content-type': 'text/plain',
          'content-length': '128'
        })
      )
    ).toThrowError('Content-Type must be application/json');

    expect(() =>
      validateAIRequestHeaders(
        makeEvent({
          'content-type': 'application/json',
          'content-length': String(1024 * 1024 + 1)
        })
      )
    ).toThrowError('Request size exceeds limit of 1048576 bytes');
  });

  it('validates generate request bodies', () => {
    expect(
      validateAIGenerateBody({
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Summarize this' }
        ],
        stream: false
      })
    ).toEqual({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Summarize this' }
      ],
      stream: false
    });
  });

  it('rejects invalid generate request bodies', () => {
    expect(() => validateAIGenerateBody(undefined)).toThrowError(
      'Request body must be a valid JSON object'
    );
    expect(() => validateAIGenerateBody({ messages: [] })).toThrowError(
      'messages array is required and must not be empty'
    );
    expect(() =>
      validateAIGenerateBody({
        messages: [{ role: 'tool', content: 'invalid' }]
      })
    ).toThrowError('Message role must be system, user, or assistant');
    expect(() =>
      validateAIGenerateBody({
        messages: [{ role: 'user' }]
      })
    ).toThrowError('Each message must have content');
  });

  it('passes through existing HTTP errors and normalizes generic errors', () => {
    const upstream = new HTTPError({ status: 429, message: 'Rate limited' });
    expect(toAIHttpError(upstream, 'fallback')).toBe(upstream);

    const generic = toAIHttpError(new Error('socket hang up'), 'Failed to generate AI response');
    expect(generic).toBeInstanceOf(HTTPError);
    expect(generic.status).toBe(500);
    expect(generic.message).toBe('Failed to generate AI response: socket hang up');
  });

  it('maps abort errors to gateway timeouts', () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const normalized = toAIHttpError(abortError, 'fallback');
    expect(normalized.status).toBe(504);
    expect(normalized.message).toBe('AI request timed out');
  });
});
