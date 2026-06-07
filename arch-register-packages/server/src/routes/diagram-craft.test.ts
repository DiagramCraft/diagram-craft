import { describe, expect, it } from 'vitest';
import { HTTPError } from 'h3';
import {
  toDiagramCraftAIHttpError,
  validateDiagramCraftAIGenerateBody,
  validateDiagramCraftAIRequestHeaders
} from './diagram-craft.js';

const makeEvent = (headers: Record<string, string>) =>
  ({
    req: {
      headers: new Headers(headers)
    }
  }) as never;

describe('diagram craft route helpers', () => {
  it('accepts JSON requests within the size limit', () => {
    expect(() =>
      validateDiagramCraftAIRequestHeaders(
        makeEvent({
          'content-type': 'application/json; charset=utf-8',
          'content-length': '128'
        })
      )
    ).not.toThrow();
  });

  it('rejects unsupported content types and oversized requests', () => {
    expect(() =>
      validateDiagramCraftAIRequestHeaders(
        makeEvent({
          'content-type': 'text/plain',
          'content-length': '128'
        })
      )
    ).toThrowError('Content-Type must be application/json');

    expect(() =>
      validateDiagramCraftAIRequestHeaders(
        makeEvent({
          'content-type': 'application/json',
          'content-length': String(1024 * 1024 + 1)
        })
      )
    ).toThrowError('Request size exceeds limit of 1048576 bytes');
  });

  it('validates generate request bodies', () => {
    expect(
      validateDiagramCraftAIGenerateBody({
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
    expect(() => validateDiagramCraftAIGenerateBody(undefined)).toThrowError(
      'Request body must be a valid JSON object'
    );
    expect(() => validateDiagramCraftAIGenerateBody({ messages: [] })).toThrowError(
      'messages array is required and must not be empty'
    );
    expect(() =>
      validateDiagramCraftAIGenerateBody({
        messages: [{ role: 'tool', content: 'invalid' }]
      })
    ).toThrowError('Message role must be system, user, or assistant');
    expect(() =>
      validateDiagramCraftAIGenerateBody({
        messages: [{ role: 'user' }]
      })
    ).toThrowError('Each message must have content');
  });

  it('passes through existing HTTP errors and normalizes generic errors', () => {
    const upstream = new HTTPError({ status: 429, message: 'Rate limited' });
    expect(toDiagramCraftAIHttpError(upstream, 'fallback')).toBe(upstream);

    const generic = toDiagramCraftAIHttpError(
      new Error('socket hang up'),
      'Failed to generate AI response'
    );
    expect(generic).toBeInstanceOf(HTTPError);
    expect(generic.status).toBe(500);
    expect(generic.message).toBe('Failed to generate AI response: socket hang up');
  });

  it('maps abort errors to gateway timeouts', () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const normalized = toDiagramCraftAIHttpError(abortError, 'fallback');
    expect(normalized.status).toBe(504);
    expect(normalized.message).toBe('AI request timed out');
  });
});
