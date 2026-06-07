import type { H3Event } from 'h3';
import { defineHandler, getCookie, HTTPError } from 'h3';
import { verifyToken } from '../utils/jwt.js';
import type { IdentityAuthDatabase } from '../db/database.js';
import type { JWTPayload, User } from '../types.js';
import { httpAssert } from '../utils/httpAssert';

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

export const createAuthMiddleware = (db: IdentityAuthDatabase) => {
  return defineHandler(async event => {
    const token = extractToken(event);

    httpAssert.present(token, { status: 401, message: 'Missing or invalid authorization header' });

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

    httpAssert.present(user, { status: 401, message: 'User not found' });
    httpAssert.true(user.is_active, { status: 403, message: 'User account is inactive' });

    // Attach user and token to event context
    event.context.user = user;
    event.context.token = payload;
  });
};

export const requireAuth = (db: IdentityAuthDatabase) => createAuthMiddleware(db);