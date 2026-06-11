import { H3Event, EventHandlerRequest, HTTPError } from 'h3';
import type { AIGenerateRequest } from '../ai/aiServer';
import { httpAssert } from '../../utils/httpAssert';

export const validateDiagramCraftAIRequestHeaders = (event: H3Event<EventHandlerRequest>) => {
  const CONTENT_TYPE_JSON = 'application/json';
  const MAX_REQUEST_SIZE = 1 * 1024 * 1024;

  const contentTypeStr = event.req.headers.get('content-type');
  httpAssert.true(contentTypeStr?.startsWith(CONTENT_TYPE_JSON), {
    status: 415,
    statusText: 'Unsupported Media Type',
    message: `Content-Type must be ${CONTENT_TYPE_JSON}`
  });

  const contentLengthStr = event.req.headers.get('content-length');
  const contentLength = parseInt(contentLengthStr ?? '0', 10);
  httpAssert.true(contentLength <= MAX_REQUEST_SIZE, {
    status: 413,
    statusText: 'Payload Too Large',
    message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes`
  });
};

export const validateDiagramCraftAIGenerateBody = (body: unknown): AIGenerateRequest => {
  httpAssert.json(body, { message: 'Request body must be a valid JSON object' });
  const input = body as Record<string, unknown>;

  httpAssert.true(Array.isArray(input['messages']) && input['messages'].length > 0, {
    message: 'messages array is required and must not be empty'
  });

  for (const message of input['messages'] as Array<Record<string, unknown>>) {
    const role = message['role'];
    const content = message['content'];
    httpAssert.present(role, { message: 'Each message must have role' });
    httpAssert.present(content, { message: 'Each message must have content' });
    httpAssert.true(typeof role === 'string' && ['system', 'user', 'assistant'].includes(role), {
      message: 'Message role must be system, user, or assistant'
    });
  }

  return body as AIGenerateRequest;
};

export const toDiagramCraftAIHttpError = (error: unknown, fallbackMessage: string) => {
  if (HTTPError.isError(error)) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new HTTPError({
        status: 504,
        statusText: 'Gateway Timeout',
        message: 'AI request timed out'
      });
    }

    return new HTTPError({
      status: 500,
      statusText: 'Internal Server Error',
      message: `${fallbackMessage}: ${error.message}`
    });
  }

  return new HTTPError({
    status: 500,
    statusText: 'Internal Server Error',
    message: fallbackMessage
  });
};
