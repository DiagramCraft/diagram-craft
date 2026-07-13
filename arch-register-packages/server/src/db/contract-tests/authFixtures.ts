import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../database';

export const createFixtureUser = async (db: DatabaseAdapter, id = randomUUID()) => {
  const now = new Date();
  return db.auth.createUser({
    id,
    email: `${id}@example.com`,
    display_name: `User ${id}`,
    auth_provider: 'local',
    password_hash: null,
    oidc_issuer: null,
    oidc_subject: null,
    is_active: true,
    color: null,
    created_at: now,
    updated_at: now,
    last_login_at: null
  });
};
