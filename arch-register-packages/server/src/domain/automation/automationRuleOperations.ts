import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { AutomationRuleInput } from '@arch-register/api-types/automationRuleContract';
import { buildApiAuthCtx, requireWorkspaceAdmin } from '../auth/authorization';
import {
  isFieldViewRestricted,
  requireNoRestrictedFieldWrites
} from '../auth/fieldGroupAccessControl';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';
import { AUTOMATION_RULE_JOB_TYPE } from './automationRuleEvaluation';
import { listJobRuns } from '../jobs/jobOperations';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';

export const toApiAutomationRule = (rule: AutomationRuleDbResult) => ({
  id: rule.id,
  workspace: rule.workspace,
  name: rule.name,
  description: rule.description,
  schema_id: rule.schema_id,
  trigger: rule.trigger,
  conditions: rule.conditions,
  actions: rule.actions,
  enabled: rule.enabled,
  created_at: rule.created_at.toISOString(),
  updated_at: rule.updated_at.toISOString()
});

const authorize = async (db: DatabaseAdapter, workspace: string, event: AuthenticatedEvent) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  return { ws, authCtx };
};

const validateInput = async (
  db: DatabaseAdapter,
  workspace: string,
  input: AutomationRuleInput,
  authCtx: WorkspaceAuthorizationContext
) => {
  let schemas: SchemaDbResult[] = [];
  const hasAccessSensitiveAction = input.actions.some(
    action =>
      action.kind === 'set_field_value' ||
      (action.kind === 'send_notification' && action.recipient.kind === 'reference_owner')
  );
  if (input.schema_id != null) {
    const schema = await db.catalog.getSchema(workspace, input.schema_id);
    httpAssert.true(schema != null, {
      status: 400,
      message: 'Automation rule references an entity type from another workspace'
    });
    if (schema) schemas = [schema];
  } else if (input.conditions.length > 0 || hasAccessSensitiveAction) {
    // Rule isn't scoped to a single schema, so a condition or action field could resolve against
    // any schema in the workspace — check restriction against all of them.
    schemas = await db.catalog.listSchemas(workspace);
  }
  httpAssert.true(input.actions.length > 0, {
    status: 400,
    message: 'A rule needs at least one action'
  });

  for (const condition of input.conditions) {
    const restricted = schemas.some(schema =>
      isFieldViewRestricted(authCtx, schema, condition.field)
    );
    httpAssert.true(!restricted, {
      status: 403,
      statusText: 'Forbidden',
      message: `Automation rule condition references a restricted field: ${condition.field}`
    });
  }

  for (const action of input.actions) {
    if (action.kind === 'set_field_value') {
      for (const schema of schemas) {
        requireNoRestrictedFieldWrites(
          authCtx,
          schema,
          [action.field],
          `Automation rule action cannot edit a restricted field: ${action.field}`
        );
      }
    } else if (action.kind === 'send_notification') {
      if (action.recipient.kind !== 'reference_owner') continue;
      const field = action.recipient.field;
      const restricted = schemas.some(schema => isFieldViewRestricted(authCtx, schema, field));
      httpAssert.true(!restricted, {
        status: 403,
        statusText: 'Forbidden',
        message: `Automation rule notification recipient references a restricted field: ${field}`
      });
    }
  }
};

export const listAutomationRules = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const { ws } = await authorize(db, workspace, event);
  return (await db.automationRule.listRules(ws)).map(toApiAutomationRule);
};

export const createAutomationRule = async (
  db: DatabaseAdapter,
  workspace: string,
  input: AutomationRuleInput,
  event: AuthenticatedEvent
) => {
  const { ws, authCtx } = await authorize(db, workspace, event);
  await validateInput(db, ws, input, authCtx);
  const now = new Date();
  const rule = await db.automationRule.createRule({
    id: randomUUID(),
    workspace: ws,
    name: input.name,
    description: input.description ?? null,
    schema_id: input.schema_id ?? null,
    trigger: input.trigger,
    conditions: input.conditions,
    actions: input.actions,
    enabled: input.enabled,
    created_at: now,
    updated_at: now
  });
  return toApiAutomationRule(rule);
};

export const updateAutomationRule = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  input: AutomationRuleInput,
  event: AuthenticatedEvent
) => {
  const { ws, authCtx } = await authorize(db, workspace, event);
  const existing = await db.automationRule.getRule(ws, id);
  httpAssert.present(existing, { status: 404, message: 'Automation rule not found' });
  await validateInput(db, ws, input, authCtx);
  const updated = await db.automationRule.updateRule(ws, id, {
    name: input.name,
    description: input.description ?? null,
    schema_id: input.schema_id ?? null,
    trigger: input.trigger,
    conditions: input.conditions,
    actions: input.actions,
    enabled: input.enabled,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Automation rule not found' });
  return toApiAutomationRule(updated);
};

export const deleteAutomationRule = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  const { ws } = await authorize(db, workspace, event);
  httpAssert.true(await db.automationRule.deleteRule(ws, id), {
    status: 404,
    message: 'Automation rule not found'
  });
  return { success: true };
};

export const listAutomationRuleRuns = async (
  db: DatabaseAdapter,
  workspace: string,
  query: {
    scheduleId?: string;
    status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    plannedFrom?: string;
    plannedTo?: string;
    limit?: number;
    offset?: number;
  },
  event: AuthenticatedEvent
) => listJobRuns(db, workspace, query, event, new Date(), AUTOMATION_RULE_JOB_TYPE);
