import { defineHandler, type H3Event } from 'h3';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { AnyRouter, Context } from '@orpc/server';
import { API_PREFIXES } from '../constants';
import { orpcErrorInterceptors } from './orpcErrors';

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

    const result = await openAPIHandler.handle(options.request?.(event) ?? event.req, {
      prefix: options.prefix ?? API_PREFIXES.application,
      context: options.context(event)
    });

    return result.matched ? result.response : undefined;
  });
};
