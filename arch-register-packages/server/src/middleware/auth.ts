import { defineHandler, getHeader, createError } from 'h3';
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

export const createAuthMiddleware = (db: DatabaseAdapter) => {
  return defineHandler(async event => {
    // Skip auth if disabled
    if (process.env['AUTH_DISABLED'] === 'true') {
      return;
    }

    const authHeader = getHeader(event, 'authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);

    let payload: JWTPayload;
    try {
      payload = verifyToken(token);
    } catch (error) {
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
