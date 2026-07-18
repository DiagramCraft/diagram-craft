import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { GovernanceCaseDbResult, GovernanceEventDbResult } from './db/governanceDatabase';

/**
 * Per-case-kind hooks, registered by the domain that owns the case kind (e.g. entity-change
 * approval in #1739). #2124 intentionally ships no product case kinds — this registry exists so
 * the foundation's transactional/idempotency guarantees can be exercised by tests without a
 * real domain effect to call into.
 */
export type GovernanceCaseKindConfig = {
  /**
   * Whether `subjectId` is visible to the given actor. Defaults to false (fail closed) when a
   * case kind has no checker registered, so listing/getting a case never leaks subject existence
   * to a user who can't otherwise see it.
   */
  subjectVisible?: (
    db: DatabaseAdapter,
    authCtx: AuthorizationContext,
    subjectId: string
  ) => Promise<boolean>;
  /**
   * Applies the domain effect for a decision (e.g. "commit the approved entity revision").
   * Invoked inside the same transaction as the assignment/event write for synchronous effects —
   * throwing rolls back the whole decision, per #2124's atomicity requirement.
   */
  applyDomainEffect?: (
    tx: DatabaseAdapter,
    context: { case: GovernanceCaseDbResult; event: GovernanceEventDbResult }
  ) => Promise<void>;
};

export type GovernanceRegistry = Map<string, GovernanceCaseKindConfig>;

export const createGovernanceRegistry = (): GovernanceRegistry => new Map();
