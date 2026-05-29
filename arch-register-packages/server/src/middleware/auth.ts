import { defineHandler, getCookie, HTTPError } from 'h3';
import type { H3Event } from 'h3';
import { verifyToken } from '../utils/jwt.js';
import type { DatabaseAdapter } from '../db/database.js';
import type { User, JWTPayload } from '../types.js';

export type AuthenticatedEvent = H3Event & {
  context: {
    user: User;
    token: JWTPayload;
  };
};

const extractToken = (event: H3Event): string | null => {
  // Check Authorization header first, then fall back to cookie
  const authHeader = event.req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return getCookie(event, 'ar_access_token') ?? null;
};

export const createAuthMiddleware = (db: DatabaseAdapter) => {
  return defineHandler(async event => {
    const token = extractToken(event);

    if (!token) {
      throw new HTTPError({
        status: 401,
        message: 'Missing or invalid authorization header'
      });
    }

    let payload: JWTPayload;
    try {
      payload = verifyToken(token);
    } catch (_error) {
      throw new HTTPError({
        status: 401,
        message: 'Invalid or expired token'
      });
    }

    if (payload.type !== 'access') {
      throw new HTTPError({
        status: 401,
        message: 'Invalid token type'
      });
    }

    const user = await db.getUser(payload.sub);

    if (!user) {
      throw new HTTPError({
        status: 401,
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      throw new HTTPError({
        status: 403,
        message: 'User account is inactive'
      });
    }

    // Attach user and token to event context
    event.context.user = user;
    event.context.token = payload;
  });
};

export const requireAuth = (db: DatabaseAdapter) => {
  const middleware = createAuthMiddleware(db);
  return middleware;
};
