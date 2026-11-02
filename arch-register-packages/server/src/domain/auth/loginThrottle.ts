import { randomUUID } from 'node:crypto';
import { ORPCError } from '@orpc/server';
import type { H3Event } from 'h3';
import { createLogger } from '../../utils/logger';
import { getClientIp } from '../../utils/clientIp';
import type { AuthDatabase, AuthEventType } from './db/authDatabase';
import {
  computeLockSeconds,
  getLoginThrottlePolicy,
  normalizeThrottleUsername
} from './loginThrottlePolicy';

const logger = createLogger('auth-security');

const THROTTLED_MESSAGE = 'Too many login attempts. Please try again later.';

const getEventRetentionDays = () => {
  const parsed = Number.parseInt(process.env['AUTH_EVENT_RETENTION_DAYS'] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
};

export type LoginAttemptContext = {
  username: string;
  userId: string | null;
  ip: string | null;
};

export const getLoginAttemptContext = (
  event: H3Event,
  username: string,
  userId: string | null
): LoginAttemptContext => ({
  username: normalizeThrottleUsername(username),
  userId,
  ip: getClientIp(event)
});

/** Best-effort: persists an auth event and writes a structured log line. Never throws. */
export const recordAuthEvent = async (
  db: AuthDatabase,
  input: {
    event: AuthEventType;
    userId?: string | null;
    username?: string | null;
    ip?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> => {
  const line = `event=${input.event} username=${JSON.stringify(input.username ?? null)} ip=${input.ip ?? 'unknown'}`;
  if (input.event === 'login_success' || input.event === 'account_unlocked') {
    logger.info(line);
  } else {
    logger.warn(line);
  }
  try {
    await db.createAuthEvent({
      id: randomUUID(),
      event: input.event,
      user_id: input.userId ?? null,
      username: input.username ?? null,
      ip: input.ip ?? null,
      created_at: new Date(),
      metadata: input.metadata ?? {}
    });
  } catch (error) {
    logger.error(
      'Failed to write auth event',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};

const throttled = (
  event: H3Event,
  retryAfterSeconds: number,
  reason: 'account' | 'ip'
): ORPCError<'TOO_MANY_REQUESTS', { retry_after_seconds: number; reason: string }> => {
  event.res.errHeaders.set('Retry-After', String(retryAfterSeconds));
  return new ORPCError('TOO_MANY_REQUESTS', {
    message: THROTTLED_MESSAGE,
    data: { retry_after_seconds: retryAfterSeconds, reason }
  });
};

/**
 * Rejects the request before any password work is done if the account is locked or the
 * client IP has exceeded its failure budget. Keyed on the submitted username, so unknown
 * usernames are throttled exactly like real ones.
 */
export const assertLoginAllowed = async (
  db: AuthDatabase,
  event: H3Event,
  attempt: LoginAttemptContext
): Promise<void> => {
  const policy = getLoginThrottlePolicy();
  const now = new Date();

  const account = await db.getLoginThrottle('account', attempt.username);
  if (account?.locked_until && account.locked_until > now) {
    const retryAfter = Math.ceil((account.locked_until.getTime() - now.getTime()) / 1000);
    await recordAuthEvent(db, {
      event: 'login_throttled',
      userId: attempt.userId,
      username: attempt.username,
      ip: attempt.ip,
      metadata: { reason: 'account' }
    });
    throw throttled(event, retryAfter, 'account');
  }

  if (attempt.ip != null) {
    const ip = await db.getLoginThrottle('ip', attempt.ip);
    if (ip && ip.failure_count >= policy.ipMaxAttempts) {
      const windowEnd = ip.updated_at.getTime() + policy.ipWindowSeconds * 1000;
      if (windowEnd > now.getTime()) {
        await recordAuthEvent(db, {
          event: 'login_throttled',
          userId: attempt.userId,
          username: attempt.username,
          ip: attempt.ip,
          metadata: { reason: 'ip' }
        });
        throw throttled(event, Math.ceil((windowEnd - now.getTime()) / 1000), 'ip');
      }
    }
  }
};

export const recordLoginFailure = async (
  db: AuthDatabase,
  attempt: LoginAttemptContext
): Promise<void> => {
  const userId = attempt.userId;
  const policy = getLoginThrottlePolicy();
  const now = new Date();

  const account = await db.incrementLoginFailure(
    'account',
    attempt.username,
    now,
    policy.failureWindowSeconds
  );
  if (attempt.ip != null) {
    await db.incrementLoginFailure('ip', attempt.ip, now, policy.ipWindowSeconds);
  }

  await recordAuthEvent(db, {
    event: 'login_failed',
    userId,
    username: attempt.username,
    ip: attempt.ip,
    metadata: { failure_count: account.failure_count }
  });

  const lockSeconds = computeLockSeconds(account.failure_count, policy);
  if (lockSeconds > 0) {
    await db.setLoginLockedUntil(
      'account',
      attempt.username,
      new Date(now.getTime() + lockSeconds * 1000)
    );
    await recordAuthEvent(db, {
      event: 'account_locked',
      userId,
      username: attempt.username,
      ip: attempt.ip,
      metadata: { failure_count: account.failure_count, lock_seconds: lockSeconds }
    });
  }
};

export const recordLoginSuccess = async (
  db: AuthDatabase,
  attempt: LoginAttemptContext
): Promise<void> => {
  const userId = attempt.userId;
  await db.clearLoginThrottle('account', attempt.username);
  await recordAuthEvent(db, {
    event: 'login_success',
    userId,
    username: attempt.username,
    ip: attempt.ip
  });
  // Opportunistic retention cleanup, cheap and infrequent enough at login volume
  try {
    const day = 24 * 60 * 60 * 1000;
    await db.cleanupAuthEvents(new Date(Date.now() - getEventRetentionDays() * day));
    await db.cleanupLoginThrottle(new Date(Date.now() - day));
  } catch (error) {
    logger.error(
      'Failed to clean up auth security data',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};

/** Clears any lock/failure state for a user and records the admin action. */
export const unlockAccount = async (
  db: AuthDatabase,
  target: { id: string; user_id: string },
  actorUserId: string
): Promise<void> => {
  await db.clearLoginThrottle('account', normalizeThrottleUsername(target.user_id));
  await recordAuthEvent(db, {
    event: 'account_unlocked',
    userId: target.id,
    username: target.user_id,
    metadata: { unlocked_by: actorUserId }
  });
};
