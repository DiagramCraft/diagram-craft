import { defineHandler } from 'h3';

/**
 * Adds a minimal set of security headers to every response.
 *
 * - X-Content-Type-Options: prevents MIME-type sniffing
 * - X-Frame-Options: prevents clickjacking via iframes
 * - Referrer-Policy: limits referrer information sent to other origins
 */
export const createSecurityHeadersMiddleware = () =>
  defineHandler(event => {
    event.res.headers.set('X-Content-Type-Options', 'nosniff');
    event.res.headers.set('X-Frame-Options', 'DENY');
    event.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  });
