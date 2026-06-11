import { defineHandler, getQuery, H3, redirect } from 'h3';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { generateTokenPair } from '../../utils/jwt';
import { handleCallback } from './oidcClient';
import { setAuthCookies } from '../../utils/cookies';
import { httpAssert } from '../../utils/httpAssert';

// Clean up expired OIDC states every 5 minutes
const cleanupTimer = setInterval(
  async () => {
    if (cleanupDbAdapter) {
      await cleanupDbAdapter.auth.cleanupExpiredOidcAuthStates();
    }
  },
  5 * 60 * 1000
);
cleanupTimer.unref();

let cleanupDbAdapter: DatabaseAdapter | null = null;

// GET /api/auth/oidc/callback — browser-facing OAuth redirect, not a JSON API endpoint
export const createOidcCallbackRoute = (db: DatabaseAdapter) => {
  cleanupDbAdapter = db;

  const app = new H3();

  app.use(
    '/api/auth/oidc/callback',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'GET', { status: 405, message: 'Method not allowed' });

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      httpAssert.true(authMode === 'oidc', { message: 'OIDC authentication is not enabled' });

      const query = getQuery(event);
      const state = String(query.state ?? '');

      httpAssert.string(state, { message: 'Missing state parameter' });

      const storedState = await db.auth.getOidcAuthState(state);

      httpAssert.present(storedState, { message: 'Invalid or expired state' });

      await db.auth.deleteOidcAuthState(state);

      const redirectUri = process.env['OIDC_REDIRECT_URI'];
      if (!redirectUri) {
        throw new Error('OIDC_REDIRECT_URI not configured');
      }

      const callbackUrl = new URL(redirectUri);
      for (const [key, value] of Object.entries(query)) {
        callbackUrl.searchParams.set(key, String(value));
      }

      const claims = await handleCallback(
        callbackUrl.href,
        state,
        storedState.nonce,
        storedState.code_verifier
      );

      let user = await db.auth.getUserByOidc(claims.issuer, claims.sub);

      if (!user) {
        const userId = randomUUID();
        user = await db.auth.createUser({
          id: userId,
          user_id: `${claims.issuer}:${claims.sub}`,
          email: claims.email ?? null,
          display_name: claims.name,
          auth_provider: 'oidc',
          password_hash: null,
          oidc_issuer: claims.issuer,
          oidc_subject: claims.sub,
          is_active: true,
          color: null,
          created_at: new Date(),
          updated_at: new Date(),
          last_login_at: new Date()
        });
      } else {
        await db.auth.updateUserLastLogin(user.id, new Date());
      }

      httpAssert.true(user.is_active, {
        status: 403,
        message: 'User account is inactive'
      });

      const tokens = generateTokenPair(user);
      setAuthCookies(event, tokens.access_token, tokens.refresh_token, tokens.expires_in);

      const frontendUrl = process.env['OIDC_FRONTEND_REDIRECT_URI'] ?? '/';
      return redirect(frontendUrl, 302);
    })
  );

  return app;
};
