import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { H3Event } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { orpcAssert } from '../../utils/orpcAssert';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import { generateTokenPair, getTokenExpirySeconds } from '../../utils/jwt';
import { setAuthCookies } from '../../utils/cookies';
import { devContract } from '@arch-register/api-types/devContract';
import { isDevUserSwitcherEnabled } from './devMode';

type DevORPCContext = {
  db: DatabaseAdapter;
  event: H3Event;
};

const devRouter = implement(devContract).$context<DevORPCContext>().use(orpcErrorMiddleware);

export const devORPCRouter = devRouter.router({
  dev: {
    config: devRouter.dev.config.handler(async () => {
      return { enabled: isDevUserSwitcherEnabled() };
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

      const tokens = generateTokenPair(user);
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

export const devOpenAPIHandler = new OpenAPIHandler(devORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createDevORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await devOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event }
    });
    if (result.matched) return result.response;
  });
