import { defineHandler, getHeader, getCookie, createError } from 'h3';
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
  const authHeader = getHeader(event, 'authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return getCookie(event, 'ar_access_token') ?? null;
};

export const createAuthMiddleware = (db: DatabaseAdapter) => {
  return defineHandler(async event => {
    // Skip auth if disabled
    if (process.env['AUTH_DISABLED'] === 'true') {
      return;
    }

    const token = extractToken(event);

    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    let payload: JWTPayload;
    try {
      payload = verifyToken(token);
    } catch (_error) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    if (payload.type !== 'access') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Invalid token type'
      });
    }

    const user = await db.getUser(payload.sub);

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
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
