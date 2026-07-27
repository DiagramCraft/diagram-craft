import { requestWithURL, type H3Event } from 'h3';

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Return a request whose URL is mapped to an existing API surface.
 *
 * This keeps compatibility aliases on the same oRPC handler, so validation,
 * authorization, and business logic cannot drift between surfaces.
 */
export const requestForApiSurface = (
  event: H3Event,
  aliasPrefix: string,
  canonicalPrefix: string
) => {
  const url = new URL(event.req.url);
  if (!matchesPrefix(url.pathname, aliasPrefix)) return event.req;

  url.pathname = `${canonicalPrefix}${url.pathname.slice(aliasPrefix.length)}`;
  return requestWithURL(event.req, url.toString());
};
