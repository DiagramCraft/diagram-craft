import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { generateTokenPair, getTokenExpirySeconds } from '../../utils/jwt';
import type { UserDbResult } from './db/authDatabase';

export type RefreshRotationResult =
  | { status: 'rotated'; tokens: ReturnType<typeof generateTokenPair> }
  | { status: 'invalid' }
  | { status: 'reused' };

export const hashRefreshToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const buildRefreshSession = (
  user: UserDbResult,
  tokens: ReturnType<typeof generateTokenPair>,
  familyId: string,
  issuedAt: Date
) => ({
  id: randomUUID(),
  family_id: familyId,
  user_id: user.id,
  token_hash: hashRefreshToken(tokens.refresh_token),
  issued_at: issuedAt,
  expires_at: new Date(issuedAt.getTime() + getTokenExpirySeconds('refresh') * 1000),
  consumed_at: null,
  replaced_by: null,
  revoked_at: null
});

export const issueTokenPair = async (
  db: DatabaseAdapter,
  user: UserDbResult,
  familyId = randomUUID()
) => {
  const issuedAt = new Date();
  const tokens = generateTokenPair(user);
  await db.auth.createRefreshSession(buildRefreshSession(user, tokens, familyId, issuedAt));
  return tokens;
};

export const rotateRefreshToken = async (
  db: DatabaseAdapter,
  refreshToken: string,
  user: UserDbResult
): Promise<RefreshRotationResult> => {
  const issuedAt = new Date();
  const tokens = generateTokenPair(user);
  const nextSession = buildRefreshSession(user, tokens, randomUUID(), issuedAt);
  const tokenHash = hashRefreshToken(refreshToken);

  const status = await db.core.transaction(async tx => {
    const current = await tx.auth.getRefreshSessionByTokenHash(tokenHash);
    if (!current || current.expires_at <= issuedAt || current.user_id !== user.id) {
      return 'invalid' as const;
    }

    if (current.consumed_at || current.revoked_at) {
      await tx.auth.revokeRefreshSessionFamily(current.family_id, issuedAt);
      return 'reused' as const;
    }

    const claimed = await tx.auth.consumeRefreshSession(current.id, issuedAt, nextSession.id);
    if (!claimed) {
      await tx.auth.revokeRefreshSessionFamily(current.family_id, issuedAt);
      return 'reused' as const;
    }

    await tx.auth.createRefreshSession({
      ...nextSession,
      family_id: current.family_id
    });
    return 'rotated' as const;
  });

  return status === 'rotated' ? { status, tokens } : { status };
};

export const revokeRefreshToken = async (db: DatabaseAdapter, refreshToken: string) => {
  const session = await db.auth.getRefreshSessionByTokenHash(hashRefreshToken(refreshToken));
  if (session) {
    await db.auth.revokeRefreshSessionFamily(session.family_id, new Date());
  }
};
