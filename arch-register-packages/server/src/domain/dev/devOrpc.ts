import { implement } from '@orpc/server';
import type { H3Event } from 'h3';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import type { DatabaseAdapter } from '../../db/database';
import { orpcAssert } from '../../utils/orpcAssert';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { getTokenExpirySeconds } from '../../utils/jwt';
import { setAuthCookies } from '../../utils/cookies';
import { devContract } from '@arch-register/api-types/devContract';
import { isDevTracingEnabled, isDevUserSwitcherEnabled } from './devMode';
import { getTrace } from '../../dev/devTrace';
import { issueTokenPair } from '../auth/refreshSessions';

type DevORPCContext = {
  db: DatabaseAdapter;
  event: H3Event;
};

const devRouter = implement(devContract).$context<DevORPCContext>().use(orpcErrorMiddleware);

export const devORPCRouter = devRouter.router({
  dev: {
    config: devRouter.dev.config.handler(async () => {
      return { enabled: isDevUserSwitcherEnabled(), tracingEnabled: isDevTracingEnabled() };
    }),

    trace: devRouter.dev.trace.handler(async ({ input }) => {
      orpcAssert.true(isDevTracingEnabled(), {
        code: 'FORBIDDEN',
        message: 'Dev-mode tracing is disabled'
      });

      const record = getTrace(input.params.traceId);
      if (!record) return null;

      const stringifyParam = (value: unknown): string => {
        if (typeof value === 'string') return value;
        try {
          return JSON.stringify(value) ?? String(value);
        } catch {
          return String(value);
        }
      };

      return {
        traceId: record.traceId,
        interaction: record.interaction,
        requests: record.requests.map(request => ({
          spanId: request.spanId,
          method: request.method,
          path: request.path,
          interaction: request.interaction,
          durationMs: request.durationMs,
          status: request.status,
          error: request.error,
          sql: request.sql.map(sql => ({
            id: sql.id,
            durationMs: sql.durationMs,
            sql: sql.sql,
            params: sql.params.map(stringifyParam),
            rowCount: sql.rowCount,
            error: sql.error
          }))
        }))
      };
    }),

    listUsers: devRouter.dev.listUsers.handler(async ({ context }) => {
      orpcAssert.true(isDevUserSwitcherEnabled(), {
        code: 'FORBIDDEN',
        message: 'Dev-mode user switcher is disabled'
      });
      return (await context.db.auth.listUsers()).map(user => ({
        id: user.id,
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        is_active: user.is_active,
        is_system_actor: user.is_system_actor,
        color: user.color
      }));
    }),

    switchUser: devRouter.dev.switchUser.handler(async ({ input, context }) => {
      orpcAssert.true(isDevUserSwitcherEnabled(), {
        code: 'FORBIDDEN',
        message: 'Dev-mode user switcher is disabled'
      });

      const user = await context.db.auth.getUser(input.body.userId);
      orpcAssert.present(user, { code: 'NOT_FOUND', message: 'User not found' });
      orpcAssert.true(user.is_active, { code: 'FORBIDDEN', message: 'User account is inactive' });

      const tokens = await issueTokenPair(context.db, user);
      setAuthCookies(
        context.event,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in,
        getTokenExpirySeconds('refresh')
      );
      return { ok: true };
    })
  }
});

export const createDevORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(devORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event })
  });
