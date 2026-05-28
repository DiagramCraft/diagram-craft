import { defineHandler, readBody, getQuery, createError, H3 } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { verifyPassword } from '../utils/password.js';
import { generateTokenPair, verifyToken } from '../utils/jwt.js';
import { generateAuthUrl, handleCallback } from '../auth/oidcClient.js';

// In-memory store for OIDC state (in production, use Redis or similar)
const oidcStateStore = new Map<
  string,
  {
    state: string;
    nonce: string;
    codeVerifier: string;
    expiresAt: number;
  }
>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oidcStateStore.entries()) {
    if (value.expiresAt < now) {
      oidcStateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const createAuthRoutes = (db: DatabaseAdapter) => {
  const app = new H3();

  // GET /api/auth/config - Get authentication configuration
  app.use(
    '/api/auth/config',
    defineHandler(async event => {
      if (event.method !== 'GET') {
        throw createError({ statusCode: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      const authDisabled = process.env['AUTH_DISABLED'] === 'true';

      return {
        mode: authMode,
        disabled: authDisabled
      };
    })
  );

  // POST /api/auth/login - Username/password login
  app.use(
    '/api/auth/login',
    defineHandler(async event => {
      if (event.method !== 'POST') {
        throw createError({ statusCode: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      if (authMode !== 'local') {
        throw createError({
          statusCode: 400,
          message: 'Username/password authentication is not enabled'
        });
      }

      const body = await readBody(event);
      const { username, password } = body;

      if (!username || !password) {
        throw createError({
          statusCode: 400,
          message: 'Username and password are required'
        });
      }

      // Try to find user by ID first, then by email
      let user = await db.getUser(username);
      if (!user && username.includes('@')) {
        user = await db.getUserByEmail(username);
      }

      if (!user || user.auth_provider !== 'local' || !user.password_hash) {
        throw createError({
          statusCode: 401,
          message: 'Invalid username or password'
        });
      }

      if (!user.is_active) {
        throw createError({
          statusCode: 403,
          message: 'User account is inactive'
        });
      }

      const isValid = await verifyPassword(user.password_hash, password);

      if (!isValid) {
        throw createError({
          statusCode: 401,
          message: 'Invalid username or password'
        });
      }

      // Update last login
      await db.updateUserLastLogin(user.id, new Date());

      return generateTokenPair(user);
    })
  );

  // GET /api/auth/oidc/authorize - Initiate OIDC flow
  app.use(
    '/api/auth/oidc/authorize',
    defineHandler(async event => {
      if (event.method !== 'GET') {
        throw createError({ statusCode: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      if (authMode !== 'oidc') {
        throw createError({
          statusCode: 400,
          message: 'OIDC authentication is not enabled'
        });
      }

      const { url, state, nonce, codeVerifier } = await generateAuthUrl();

      // Store state for callback validation (expires in 10 minutes)
      oidcStateStore.set(state, {
        state,
        nonce,
        codeVerifier,
        expiresAt: Date.now() + 10 * 60 * 1000
      });

      return { authorization_url: url };
    })
  );

  // GET /api/auth/oidc/callback - OIDC callback
  app.use(
    '/api/auth/oidc/callback',
    defineHandler(async event => {
      if (event.method !== 'GET') {
        throw createError({ statusCode: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      if (authMode !== 'oidc') {
        throw createError({
          statusCode: 400,
          message: 'OIDC authentication is not enabled'
        });
      }

      const query = getQuery(event);
      const state = query.state as string;

      if (!state) {
        throw createError({
          statusCode: 400,
          message: 'Missing state parameter'
        });
      }

      const storedState = oidcStateStore.get(state);

      if (!storedState) {
        throw createError({
          statusCode: 400,
          message: 'Invalid or expired state'
        });
      }

      oidcStateStore.delete(state);

      const claims = await handleCallback(
        query as Record<string, string>,
        storedState.state,
        storedState.nonce,
        storedState.codeVerifier
      );

      // Find or create user
      let user = await db.getUserByOidc(claims.issuer, claims.sub);

      if (!user) {
        // Auto-create user on first OIDC login
        user = await db.createUser({
          id: claims.sub,
          email: claims.email ?? null,
          display_name: claims.name,
          auth_provider: 'oidc',
          password_hash: null,
          oidc_issuer: claims.issuer,
          oidc_subject: claims.sub,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          last_login_at: new Date()
        });
      } else {
        // Update last login
        await db.updateUserLastLogin(user.id, new Date());
      }

      if (!user.is_active) {
        throw createError({
          statusCode: 403,
          message: 'User account is inactive'
        });
      }

      return generateTokenPair(user);
    })
  );

  // POST /api/auth/refresh - Refresh access token
  app.use(
    '/api/auth/refresh',
    defineHandler(async event => {
      if (event.method !== 'POST') {
        throw createError({ statusCode: 405, message: 'Method not allowed' });
      }

      const body = await readBody(event);
      const { refresh_token } = body;

      if (!refresh_token) {
        throw createError({
          statusCode: 400,
          message: 'Refresh token is required'
        });
      }

      let payload;
      try {
        payload = verifyToken(refresh_token);
      } catch {
        throw createError({
          statusCode: 401,
          message: 'Invalid or expired refresh token'
        });
      }

      if (payload.type !== 'refresh') {
        throw createError({
          statusCode: 401,
          message: 'Invalid token type'
        });
      }

      const user = await db.getUser(payload.sub);

      if (!user) {
        throw createError({
          statusCode: 401,
          message: 'User not found'
        });
      }

      if (!user.is_active) {
        throw createError({
          statusCode: 403,
          message: 'User account is inactive'
        });
      }

      return generateTokenPair(user);
    })
  );

  // GET /api/auth/me - Get current user info
  app.use(
    '/api/auth/me',
    defineHandler(async event => {
      if (event.method !== 'GET') {
        throw createError({ statusCode: 405, message: 'Method not allowed' });
      }

      // This endpoint requires authentication
      const authHeader = event.node.req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createError({
          statusCode: 401,
          message: 'Missing or invalid authorization header'
        });
      }

      const token = authHeader.substring(7);

      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw createError({
          statusCode: 401,
          message: 'Invalid or expired token'
        });
      }

      if (payload.type !== 'access') {
        throw createError({
          statusCode: 401,
          message: 'Invalid token type'
        });
      }

      const user = await db.getUser(payload.sub);

      if (!user) {
        throw createError({
          statusCode: 401,
          message: 'User not found'
        });
      }

      if (!user.is_active) {
        throw createError({
          statusCode: 403,
          message: 'User account is inactive'
        });
      }

      // Return user info without sensitive data
      return {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        created_at: user.created_at.toISOString(),
        last_login_at: user.last_login_at?.toISOString() ?? null
      };
    })
  );

  return app;
};