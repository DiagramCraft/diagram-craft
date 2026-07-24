import type { DatabaseAdapter } from '../../db/database';
import type { AutomationAction } from '@arch-register/api-types/automationRuleContract';
import { runAutomationAction } from './automationActionHandlers';
import type { AutomationRuleEvent } from './automationRuleEvaluation';

const isAutomationRuleEvent = (value: unknown): value is AutomationRuleEvent =>
  typeof value === 'object' &&
  value != null &&
  'version' in value &&
  (value as { version: unknown }).version === '1' &&
  'entityId' in value &&
  typeof (value as { entityId: unknown }).entityId === 'string';

/**
 * Job handler for `automation-rule.execute` runs, registered in job-server/src/main.ts alongside
 * the webhook delivery handler. Each run executes every action of a single matched rule against
 * the entity snapshot captured when the rule matched (see enqueueAutomationRuleRuns).
 */
export const createAutomationRuleExecutionHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const ruleId = context.payload['ruleId'];
    const event = context.payload['event'];
    const chainRaw = context.payload['automationRuleChain'];
    if (typeof ruleId !== 'string' || !isAutomationRuleEvent(event)) {
      throw new Error('Automation rule execution job has an invalid payload');
    }
    const chain = Array.isArray(chainRaw)
      ? chainRaw.filter((id): id is string => typeof id === 'string')
      : [];

    const rule = await db.automationRule.getRule(context.workspace, ruleId);
    if (!rule?.enabled) return { skipped: true };

    const errors: string[] = [];
    for (const action of rule.actions as AutomationAction[]) {
      try {
        await runAutomationAction({ db, rule, action, event, chain });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Automation rule '${rule.name}' failed ${errors.length}/${rule.actions.length} action(s): ${errors.join('; ')}`
      );
    }
    return { actionsExecuted: rule.actions.length };
  };
