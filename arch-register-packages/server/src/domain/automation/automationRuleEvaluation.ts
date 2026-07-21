import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuditLogDbResult } from '../audit/db/auditDatabase';
import { flattenEntityAuditFields } from '../audit/db/auditFieldFlattening';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import type {
  AutomationCondition,
  AutomationRuleTrigger
} from '@arch-register/api-types/automationRuleContract';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';

/** Job type used for every automation rule action execution. Exported so the job server can
 *  register its handler and `listJobRuns` can filter the shared `job_run` table down to just
 *  automation rule runs. */
export const AUTOMATION_RULE_JOB_TYPE = 'automation-rule.execute';
const SYSTEM_IDENTITY = 'automation-rules';

/** Once a rule-triggered update's chain reaches this length, no further rules are enqueued for
 *  it. This is a backstop against runaway chains of rules that legitimately trigger one another
 *  a few times; the per-rule id check below is what actually prevents tight self-loops. */
export const AUTOMATION_RULE_MAX_CHAIN_LENGTH = 5;

export type AutomationRuleEvent = {
  version: '1';
  auditLogId: string;
  workspace: string;
  operation: AuditLogDbResult['operation'];
  entityId: string;
  entityName: string;
  entitySlug: string | null;
  schemaId: string | null;
  actor: { id: string | null; displayName: string | null };
  occurredAt: string;
  changes: AuditLogDbResult['changes'];
  fieldValues: Record<string, unknown>;
};

const matchesTrigger = (trigger: AutomationRuleTrigger, auditLog: AuditLogDbResult): boolean => {
  switch (trigger.kind) {
    case 'entity_created':
      return auditLog.operation === 'create';
    case 'entity_deleted':
      return auditLog.operation === 'delete';
    case 'field_changed':
      return (
        auditLog.operation === 'update' &&
        (Object.hasOwn(auditLog.changes.old ?? {}, trigger.field) ||
          Object.hasOwn(auditLog.changes.new ?? {}, trigger.field))
      );
    case 'lifecycle_transition': {
      if (auditLog.operation !== 'update') return false;
      const old = auditLog.changes.old ?? {};
      const next = auditLog.changes.new ?? {};
      if (!Object.hasOwn(old, '_lifecycle') && !Object.hasOwn(next, '_lifecycle')) return false;
      const fromMatches = trigger.from == null || old['_lifecycle'] === trigger.from;
      const toMatches = trigger.to == null || next['_lifecycle'] === trigger.to;
      return fromMatches && toMatches;
    }
  }
};

const isEmptyValue = (value: unknown) =>
  value == null || value === '' || (Array.isArray(value) && value.length === 0);

const evaluateCondition = (
  condition: AutomationCondition,
  fieldValues: Record<string, unknown>
) => {
  const value = fieldValues[condition.field];
  switch (condition.operator) {
    case 'equals':
      return JSON.stringify(value ?? null) === JSON.stringify(condition.value ?? null);
    case 'not_equals':
      return JSON.stringify(value ?? null) !== JSON.stringify(condition.value ?? null);
    case 'is_empty':
      return isEmptyValue(value);
    case 'is_not_empty':
      return !isEmptyValue(value);
  }
};

const evaluateConditions = (
  conditions: AutomationCondition[],
  fieldValues: Record<string, unknown>
) => conditions.every(condition => evaluateCondition(condition, fieldValues));

/**
 * Resolves the field values a rule's conditions are matched against. `create`/`delete` audit
 * rows already carry the full flattened entity in `changes.new`/`changes.old` (see
 * `flattenEntityAuditFields`), but `update` rows only carry the fields that actually changed
 * (see `computeChanges`) — so conditions on unrelated fields need the live entity. We're inside
 * the same transaction as the mutation, so this read sees the just-written row.
 */
const resolveFieldValues = async (
  db: DatabaseAdapter,
  auditLog: AuditLogDbResult
): Promise<Record<string, unknown>> => {
  if (auditLog.operation === 'create') return auditLog.changes.new ?? {};
  if (auditLog.operation === 'delete') return auditLog.changes.old ?? {};

  const entity = await db.catalog.getEntity(auditLog.workspace, auditLog.entity_id);
  if (entity) return flattenEntityAuditFields(entity);
  return { ...(auditLog.changes.old ?? {}), ...(auditLog.changes.new ?? {}) };
};

const toAutomationRuleEvent = (
  auditLog: AuditLogDbResult,
  fieldValues: Record<string, unknown>
): AutomationRuleEvent => ({
  version: '1',
  auditLogId: auditLog.id,
  workspace: auditLog.workspace,
  operation: auditLog.operation,
  entityId: auditLog.entity_id,
  entityName: auditLog.entity_name,
  entitySlug: auditLog.entity_slug,
  schemaId: auditLog.schema_id,
  actor: { id: auditLog.user_id, displayName: auditLog.user_display_name },
  occurredAt: auditLog.timestamp.toISOString(),
  changes: auditLog.changes,
  fieldValues
});

/**
 * Matches automation rules against an entity audit row and enqueues one job run per matching
 * rule, mirroring `enqueueWebhookDeliveries`. Matching (trigger + condition evaluation) happens
 * synchronously here, inside the same transaction as the mutation; the rule's *actions* run later
 * via the job queue (see automationRuleExecution.ts).
 *
 * `metadata.automationRuleChain` carries the ids of rules that already fired earlier in this
 * causal chain (threaded through `set_field_value` re-entering `writeAudit`). A rule already in
 * the chain is skipped to prevent a rule from re-triggering itself; the chain is also capped in
 * length as a backstop against longer cycles between distinct rules.
 */
export const enqueueAutomationRuleRuns = async (
  db: DatabaseAdapter,
  auditLog: AuditLogDbResult,
  metadata?: Record<string, unknown>
): Promise<number> => {
  if (auditLog.entity_type !== 'entity') return 0;

  const chain = Array.isArray(metadata?.['automationRuleChain'])
    ? (metadata!['automationRuleChain'] as unknown[]).filter(
        (id): id is string => typeof id === 'string'
      )
    : [];
  if (chain.length >= AUTOMATION_RULE_MAX_CHAIN_LENGTH) return 0;

  const rules = await db.automationRule.listRules(auditLog.workspace);
  const matchingRules = rules.filter(
    (rule): rule is AutomationRuleDbResult =>
      rule.enabled &&
      (rule.schema_id == null || rule.schema_id === auditLog.schema_id) &&
      matchesTrigger(rule.trigger, auditLog) &&
      !chain.includes(rule.id)
  );
  if (matchingRules.length === 0) return 0;

  const fieldValues = await resolveFieldValues(db, auditLog);
  const toRun = matchingRules.filter(rule => evaluateConditions(rule.conditions, fieldValues));
  if (toRun.length === 0) return 0;

  const event = toAutomationRuleEvent(auditLog, fieldValues);
  for (const rule of toRun) {
    await enqueueOneOffJobRun(db, {
      id: randomUUID(),
      workspace: auditLog.workspace,
      jobType: AUTOMATION_RULE_JOB_TYPE,
      systemIdentity: SYSTEM_IDENTITY,
      payload: {
        ruleId: rule.id,
        automationRuleChain: [...chain, rule.id],
        event
      },
      maxAttempts: 5
    });
  }
  return toRun.length;
};
