import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { DatabaseError } from '../database';
import { createFixtureUser } from './authFixtures';

runContractSuiteAgainstBothDrivers('AuthDatabase', getDb => {
  describe('user CRUD', () => {
    it('creates and reads back a user with normalized types', async () => {
      const db = getDb();
      const created = await createFixtureUser(db);

      expect(created.created_at).toBeInstanceOf(Date);
      expect(created.updated_at).toBeInstanceOf(Date);
      expect(created.is_active).toBe(true);
      expect(created.last_login_at).toBeNull();

      const fetched = await db.auth.getUser(created.id);
      expect(fetched!.id).toBe(created.id);

      expect((await db.auth.getUserByUserId(created.user_id))!.id).toBe(created.id);
      expect((await db.auth.getUserByEmail(created.email!))!.id).toBe(created.id);
    });

    it('updates a user and reflects the change on read', async () => {
      const db = getDb();
      const created = await createFixtureUser(db);

      const updated = await db.auth.updateUser(created.id, {
        display_name: 'Renamed User',
        is_active: false,
        updated_at: new Date()
      });

      expect(updated!.display_name).toBe('Renamed User');
      expect(updated!.is_active).toBe(false);
    });

    it('updates last login timestamp', async () => {
      const db = getDb();
      const created = await createFixtureUser(db);
      const loginAt = new Date();

      await db.auth.updateUserLastLogin(created.id, loginAt);

      const fetched = await db.auth.getUser(created.id);
      expect(fetched!.last_login_at?.getTime()).toBe(loginAt.getTime());
    });

    it('finds a user by oidc issuer/subject', async () => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date();
      await db.auth.createUser({
        id,
        email: null,
        display_name: 'OIDC User',
        auth_provider: 'oidc',
        password_hash: null,
        oidc_issuer: 'https://issuer.example.com',
        oidc_subject: 'subject-1',
        is_active: true,
        color: null,
        created_at: now,
        updated_at: now,
        last_login_at: null
      });

      const found = await db.auth.getUserByOidc('https://issuer.example.com', 'subject-1');
      expect(found!.id).toBe(id);
      expect(
        await db.auth.getUserByOidc('https://issuer.example.com', 'no-such-subject')
      ).toBeNull();
    });

    it('lists users ordered by display name', async () => {
      const db = getDb();
      await createFixtureUser(db);
      await createFixtureUser(db);

      const users = await db.auth.listUsers();
      const names = users.map(u => u.display_name);
      expect(names).toEqual([...names].sort());
    });

    it('normalizes a duplicate email to a unique DatabaseError', async () => {
      const db = getDb();
      const created = await createFixtureUser(db);

      await expect(
        db.auth.createUser({
          id: randomUUID(),
          email: created.email,
          display_name: 'Someone else',
          auth_provider: 'local',
          password_hash: null,
          oidc_issuer: null,
          oidc_subject: null,
          is_active: true,
          color: null,
          created_at: new Date(),
          updated_at: new Date(),
          last_login_at: null
        })
      ).rejects.toMatchObject({ code: 'unique' } satisfies Partial<DatabaseError>);
    });

    it('normalizes a duplicate user_id to a unique DatabaseError', async () => {
      const db = getDb();
      const created = await createFixtureUser(db);

      await expect(
        db.auth.createUser({
          id: randomUUID(),
          user_id: created.user_id,
          email: `${randomUUID()}@example.com`,
          display_name: 'Someone else',
          auth_provider: 'local',
          password_hash: null,
          oidc_issuer: null,
          oidc_subject: null,
          is_active: true,
          color: null,
          created_at: new Date(),
          updated_at: new Date(),
          last_login_at: null
        })
      ).rejects.toMatchObject({ code: 'unique' } satisfies Partial<DatabaseError>);
    });
  });

  describe('global role assignments', () => {
    it('replaces role assignments atomically', async () => {
      const db = getDb();
      const user = await createFixtureUser(db);

      const first = await db.auth.replaceGlobalRoleAssignments(
        user.id,
        ['workspace_admin'],
        new Date()
      );
      expect(first.map(r => r.role)).toEqual(['workspace_admin']);

      const second = await db.auth.replaceGlobalRoleAssignments(
        user.id,
        ['global_admin', 'workspace_admin'],
        new Date()
      );
      expect(second.map(r => r.role).sort()).toEqual(['global_admin', 'workspace_admin']);

      const listed = await db.auth.listGlobalRoleAssignments(user.id);
      expect(listed.map(r => r.role).sort()).toEqual(['global_admin', 'workspace_admin']);
    });

    it('replacing with an empty list clears assignments', async () => {
      const db = getDb();
      const user = await createFixtureUser(db);

      await db.auth.replaceGlobalRoleAssignments(user.id, ['global_admin'], new Date());
      const cleared = await db.auth.replaceGlobalRoleAssignments(user.id, [], new Date());

      expect(cleared).toEqual([]);
      expect(await db.auth.listGlobalRoleAssignments(user.id)).toEqual([]);
    });
  });

  describe('API tokens', () => {
    it('creates, finds, lists, updates, and deletes workspace tokens', async () => {
      const db = getDb();
      const user = await createFixtureUser(db);
      const now = new Date();
      const workspace = await db.workspace.createWorkspace({
        id: randomUUID(),
        name: `Token workspace ${randomUUID()}`,
        url_slug: `token-workspace-${randomUUID()}`,
        short_code: 'TOK',
        color: '',
        description: '',
        created_at: now,
        updated_at: now
      });

      const created = await db.auth.createApiToken({
        id: randomUUID(),
        workspace: workspace.id,
        name: 'Release pipeline',
        token_hash: 'hash-1',
        capabilities: ['ent.edit', 'content.view'],
        created_by: user.id,
        created_at: now,
        last_used_at: null,
        expires_at: new Date(now.getTime() + 60_000)
      });

      expect(created.capabilities).toEqual(['ent.edit', 'content.view']);
      expect(await db.auth.getApiTokenByHash('hash-1')).toMatchObject({ id: created.id });
      expect(await db.auth.listApiTokens(workspace.id)).toEqual([created]);
      expect(await db.auth.countApiTokens(workspace.id, user.id)).toBe(1);
      expect(await db.auth.listApiTokensByCreator(user.id)).toEqual([created]);

      const audit = await db.auth.createApiTokenAudit({
        id: randomUUID(),
        workspace: workspace.id,
        token_id: created.id,
        user_id: user.id,
        event: 'created',
        created_at: now,
        metadata: { name: created.name }
      });
      expect(await db.auth.listApiTokenAudit(workspace.id)).toEqual([audit]);

      const lastUsed = new Date(now.getTime() + 10_000);
      await db.auth.updateApiTokenLastUsed(created.id, lastUsed);
      expect((await db.auth.getApiTokenByHash('hash-1'))?.last_used_at).toEqual(lastUsed);

      expect(await db.auth.deleteApiToken(workspace.id, created.id)).toMatchObject({
        id: created.id
      });
      expect(await db.auth.getApiTokenByHash('hash-1')).toBeNull();
      expect(await db.auth.deleteApiToken(workspace.id, created.id)).toBeNull();
      expect(await db.auth.deleteApiTokenByCreator(user.id, created.id)).toBeNull();
    });
  });

  describe('oidc auth state', () => {
    it('stores, reads and deletes auth state', async () => {
      const db = getDb();
      const state = randomUUID();

      await db.auth.storeOidcAuthState(
        state,
        'nonce-1',
        'verifier-1',
        new Date(Date.now() + 60_000)
      );

      const found = await db.auth.getOidcAuthState(state);
      expect(found).toEqual({ nonce: 'nonce-1', code_verifier: 'verifier-1' });

      await db.auth.deleteOidcAuthState(state);
      expect(await db.auth.getOidcAuthState(state)).toBeNull();
    });

    it('cleans up only expired auth states', async () => {
      const db = getDb();
      const expiredState = randomUUID();
      const activeState = randomUUID();

      await db.auth.storeOidcAuthState(expiredState, 'n', 'v', new Date(Date.now() - 60_000));
      await db.auth.storeOidcAuthState(activeState, 'n', 'v', new Date(Date.now() + 60_000));

      await db.auth.cleanupExpiredOidcAuthStates();

      expect(await db.auth.getOidcAuthState(expiredState)).toBeNull();
      expect(await db.auth.getOidcAuthState(activeState)).not.toBeNull();
    });
  });
});
