import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import type {
  GovernanceAssignmentAction,
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from './db/governanceDatabase';
import type { GovernanceAssignmentTarget } from './governanceOperations';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';

/**
 * Per-case-kind hooks, registered by the domain that owns the case kind (e.g. entity-change
 * approval in #1739). #2124 intentionally ships no product case kinds — this registry exists so
 * the foundation's transactional/idempotency guarantees can be exercised by tests without a
 * real domain effect to call into.
 */
export type GovernanceCaseKindConfig = {
  /** Metadata and validation used by the centralized workflow configuration API. */
  workflowConfig?: {
    supportsSubkind?: boolean;
    supportsApprovals?: boolean;
    supportsReminders?: boolean;
    supportsEscalation?: boolean;
    defaultConfig?: GovernanceWorkflowConfig;
    validateSubkind?: (
      db: DatabaseAdapter,
      workspace: string,
      subkind: string | null
    ) => Promise<string | null>;
    labelSubkind?: (
      db: DatabaseAdapter,
      workspace: string,
      subkind: string | null
    ) => Promise<string | null>;
    validateConfig?: (config: GovernanceWorkflowConfig) => void;
  };
  /**
   * Whether `subjectId` is visible to the given actor. Defaults to false (fail closed) when a
   * case kind has no checker registered, so listing/getting a case never leaks subject existence
   * to a user who can't otherwise see it.
   */
  subjectVisible?: (
    db: DatabaseAdapter,
    authCtx: AuthorizationContext,
    workspace: string,
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
  /** Handles domain state transitions for decisions that do not apply the approved effect. */
  handleDecision?: (
    tx: DatabaseAdapter,
    context: {
      case: GovernanceCaseDbResult;
      event: GovernanceEventDbResult;
      decision: 'approve' | 'reject' | 'request_changes' | 'acknowledge';
    }
  ) => Promise<void>;
  /**
   * Decides whether this particular decision completes the case. Returning false leaves sibling
   * assignments open, which is used by document status quorum approval.
   */
  shouldCompleteCase?: (context: {
    tx: DatabaseAdapter;
    case: GovernanceCaseDbResult;
    assignmentId: string;
    actorUserId: string;
    decision: 'approve' | 'reject' | 'request_changes' | 'acknowledge';
  }) => Promise<boolean>;
  beforeDecision?: (
    tx: DatabaseAdapter,
    context: {
      case: GovernanceCaseDbResult;
      assignmentId: string;
      actorUserId: string;
      decision: 'approve' | 'reject' | 'request_changes' | 'acknowledge';
    }
  ) => Promise<'proceed' | 'stale'>;
  /**
   * Actions whose assignments are independent: deciding one does not supersede sibling open
   * assignments of the same action, and does not complete the case, even though the action is
   * otherwise in `CASE_COMPLETING_DECISIONS`. Used for group acknowledgement (#1718), where each
   * affected owner team gets its own ack assignment and the case stays open until an explicit
   * domain-specific finalize action closes it. Absent/empty for existing case kinds (#1739),
   * which keeps their single-decision-closes-the-case behavior unchanged.
   */
  independentAssignmentActions?: Set<GovernanceAssignmentAction>;
  /**
   * Default day thresholds for #2418's scheduled reminder scan. Presence of this field is what
   * makes a case kind eligible for scheduled reminders at all; its values are a fallback used
   * when a workspace or case-subkind has no override row in
   * `workspace_governance_case_config` for this kind (see governanceDeadlineScanJob.ts).
   */
  reminders?: {
    /** Fire once due_at is within N days (going forward), for each N. */
    approachingDays: number[];
    /** Fire once N days past due_at, for each N. */
    overdueDays: number[];
  };
  /** Resolves reminder windows from the current domain state for runtime-driven case kinds. */
  resolveReminderWindows?: (
    db: DatabaseAdapter,
    caseRow: GovernanceCaseDbResult
  ) => Promise<{ approachingDays: number[]; overdueDays: number[] } | null>;
  /** Runtime-driven reminder windows are owned by the case subject, not workspace overrides. */
  workspaceReminderOverrides?: boolean;
  /**
   * #2420: escalation for cases that remain open past their deadline. Presence of this field is
   * what makes a case kind eligible for escalation at all. Workspace or case-subkind configuration
   * can turn it off or change its threshold and fallback targets. Fires once per case, guarded by
   * `governance_case.escalated_at`.
   */
  escalation?: {
    /** Days overdue at which escalation fires. */
    overdueDays: number;
    /** Resolves the escalation target for a given (fresh) case row; null skips escalation. */
    target: (
      db: DatabaseAdapter,
      caseRow: GovernanceCaseDbResult
    ) => Promise<GovernanceAssignmentTarget | null>;
  };
};

export type GovernanceRegistry = Map<string, GovernanceCaseKindConfig>;

export const createGovernanceRegistry = (): GovernanceRegistry => new Map();

/**
 * Returns the canonical defaults exposed to the workflow settings surface and used when a
 * workspace has no override. Domain registrations keep the runtime hooks in their existing
 * fields, while this helper presents those defaults in the shared config shape.
 */
export const defaultWorkflowConfigForCaseKind = (
  config: GovernanceCaseKindConfig
): GovernanceWorkflowConfig => {
  const declared = config.workflowConfig?.defaultConfig;
  return {
    approvals: declared?.approvals,
    reminders:
      declared?.reminders ??
      (config.reminders ? { enabled: true, ...config.reminders } : undefined),
    escalation:
      declared?.escalation ??
      (config.escalation
        ? {
            enabled: true,
            overdueDays: config.escalation.overdueDays,
            fallbackUserIds: [],
            fallbackTeamIds: []
          }
        : undefined),
    extensions: declared?.extensions ?? {}
  };
};
