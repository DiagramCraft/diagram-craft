import type { H3Event } from 'h3';
import { defineHandler, getCookie, HTTPError } from 'h3';
import { verifyToken } from '../utils/jwt';
import type { AuthDatabase } from '../db/database';
import type { JWTPayload } from '../types';
import { httpAssert } from '../utils/httpAssert';
import { UserDbResult } from '../domain/auth/db/authDatabase';
import type {
  AuthorizationContext,
  WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import {
  API_TOKEN_PREFIX,
  hashApiToken,
  toApiTokenPrincipal,
  type ApiTokenPrincipal
} from '../domain/auth/apiTokens';
import { recordApiTokenAudit } from '../domain/auth/apiTokenAudit';

export type AuthenticatedEvent = H3Event & {
  context: {
    user: UserDbResult;
    token: JWTPayload | ApiTokenPrincipal;
    apiToken?: ApiTokenPrincipal;
    authorizationContextCache?: Map<string, Promise<WorkspaceAuthorizationContext>>;
    entityAuthorizationContextCache?: Map<string, Promise<AuthorizationContext>>;
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

export const createAuthMiddleware = (db: AuthDatabase) => {
  return defineHandler(async event => {
    const token = extractToken(event);
    const authHeader = event.req.headers.get('authorization');
    const isBearerHeader = authHeader?.startsWith('Bearer ') ?? false;
    const isApiTokenCandidate = isBearerHeader && token?.startsWith(API_TOKEN_PREFIX);

    httpAssert.present(token, {
      status: 401,
      message: 'Missing or invalid authorization header',
      data: { expected: true }
    });

    let payload: JWTPayload | null = null;
    try {
      payload = verifyToken(token);
    } catch (_error) {
      if (!isApiTokenCandidate) {
        throw new HTTPError({
          status: 401,
          message: 'Invalid or expired token'
        });
      }
    }

    if (payload == null) {
      const apiToken = await db.getApiTokenByHash(hashApiToken(token));
      if (!apiToken || (apiToken.expires_at != null && apiToken.expires_at <= new Date())) {
        throw new HTTPError({
          status: 401,
          message: 'Invalid or expired token'
        });
      }

      const user = await db.getUser(apiToken.created_by);
      httpAssert.present(user, { status: 401, message: 'User not found' });
      httpAssert.true(user.is_active, { status: 403, message: 'User account is inactive' });

      const principal = toApiTokenPrincipal(apiToken);
      event.context.user = user;
      event.context.token = principal;
      event.context.apiToken = principal;
      await db.updateApiTokenLastUsed(apiToken.id, new Date());
      await recordApiTokenAudit(db, {
        workspace: apiToken.workspace,
        tokenId: apiToken.id,
        userId: apiToken.created_by,
        event: 'used'
      });
      return;
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

export const requireAuth = (db: AuthDatabase) => createAuthMiddleware(db);
