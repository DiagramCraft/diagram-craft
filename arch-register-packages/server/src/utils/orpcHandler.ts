import { defineHandler, type H3Event } from 'h3';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { AnyRouter, Context } from '@orpc/server';
import { API_PREFIXES } from '../constants';
import { orpcErrorInterceptors } from './orpcErrors';
import { isDevTracingEnabled } from '../domain/dev/devMode';
import {
  discardRequestSpan,
  finishRequestSpan,
  startRequestSpan,
  withRequestSpan
} from '../dev/devTrace';

type HttpPrefix = `/${string}`;

export type OrpcHandlerOptions<TContext extends Context> = {
  context: (event: H3Event) => TContext;
  prefix?: HttpPrefix;
  request?: (event: H3Event) => Request;
  shouldHandle?: (event: H3Event) => boolean | Promise<boolean>;
  beforeHandle?: (event: H3Event) => void | Promise<void>;
};

/**
 * Creates the H3 adapter shared by Arch Register's OpenAPI-backed oRPC routes.
 *
 * The OpenAPI handler is created once for the route instance. Request-specific
 * context is built only when the route elects to handle the current event, and
 * unmatched requests are left for the next H3 handler in the chain.
 */
const decodeInteraction = (raw: string | null): string | undefined => {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const createOrpcHandler = <TContext extends Context>(
  router: AnyRouter,
  options: OrpcHandlerOptions<TContext>
) => {
  const openAPIHandler = new OpenAPIHandler(router, {
    clientInterceptors: orpcErrorInterceptors
  });

  return defineHandler(async event => {
    if (options.shouldHandle && !(await options.shouldHandle(event))) return;

    await options.beforeHandle?.(event);

    const request = options.request?.(event) ?? event.req;
    const prefix = options.prefix ?? API_PREFIXES.application;
    const context = options.context(event);

    const traceId =
      isDevTracingEnabled() && request.headers.get('x-dev-trace-id')
        ? (request.headers.get('x-dev-trace-id') as string)
        : undefined;

    if (!traceId) {
      const result = await openAPIHandler.handle(request, { prefix, context });
      return result.matched ? result.response : undefined;
    }

    const span = startRequestSpan({
      traceId,
      spanId: request.headers.get('x-dev-span-id') ?? Math.random().toString(36).slice(2, 10),
      interaction: decodeInteraction(request.headers.get('x-dev-interaction')),
      method: request.method,
      path: new URL(request.url).pathname
    });

    try {
      const result = await withRequestSpan(span, () =>
        openAPIHandler.handle(request, { prefix, context })
      );
      if (result.matched) {
        finishRequestSpan(span, { status: result.response.status });
        return result.response;
      }
      discardRequestSpan(span);
      return undefined;
    } catch (error) {
      finishRequestSpan(span, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  });
};
