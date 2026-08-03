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
import type { RelationSchemaDbResult } from '../catalog/db/relationDatabase';

export const AUTOMATION_RULE_REDACTED_LITERAL = '[redacted]';

const hasFieldReferences = (
  rule: Pick<AutomationRuleDbResult, 'trigger' | 'conditions' | 'actions'>
) =>
  rule.trigger.kind === 'field_changed' ||
  rule.trigger.kind === 'relation_field_changed' ||
  rule.conditions.length > 0 ||
  rule.actions.some(
    action =>
      action.kind === 'set_field_value' ||
      (action.kind === 'send_notification' && action.recipient.kind === 'reference_owner')
  );

const hasRestrictedFieldReference = (
  authCtx: WorkspaceAuthorizationContext,
  rule: Pick<AutomationRuleDbResult, 'trigger' | 'conditions' | 'actions'>,
  schemas: Array<SchemaDbResult | RelationSchemaDbResult>,
  schemaMissing: boolean
) => {
  if (schemaMissing || schemas.length === 0) return hasFieldReferences(rule);

  const isRestricted = (fieldId: string) =>
    schemas.some(schema => isFieldViewRestricted(authCtx, schema, fieldId));

  return (
    ((rule.trigger.kind === 'field_changed' || rule.trigger.kind === 'relation_field_changed') &&
      isRestricted(rule.trigger.field)) ||
    rule.conditions.some(condition => isRestricted(condition.field)) ||
    rule.actions.some(action => {
      if (action.kind === 'set_field_value') return isRestricted(action.field);
      return (
        action.kind === 'send_notification' &&
        action.recipient.kind === 'reference_owner' &&
        isRestricted(action.recipient.field)
      );
    })
  );
};

const redactAutomationRule = (
  rule: AutomationRuleDbResult,
  authCtx: WorkspaceAuthorizationContext,
  schemas: Array<SchemaDbResult | RelationSchemaDbResult>,
  schemaMissing: boolean
) => {
  if (!hasRestrictedFieldReference(authCtx, rule, schemas, schemaMissing)) return rule;

  const redactString = (value: string | null | undefined) =>
    value == null ? value : AUTOMATION_RULE_REDACTED_LITERAL;

  return {
    ...rule,
    trigger:
      rule.trigger.kind === 'lifecycle_transition'
        ? {
            ...rule.trigger,
            from: redactString(rule.trigger.from),
            to: redactString(rule.trigger.to)
          }
        : rule.trigger,
    conditions: rule.conditions.map(condition =>
      Object.hasOwn(condition, 'value')
        ? { ...condition, value: AUTOMATION_RULE_REDACTED_LITERAL }
        : condition
    ),
    actions: rule.actions.map(action => {
      if (action.kind === 'create_audit_note') {
        return { ...action, note: AUTOMATION_RULE_REDACTED_LITERAL };
      }
      if (action.kind === 'send_notification') {
        return { ...action, message: AUTOMATION_RULE_REDACTED_LITERAL };
      }
      return { ...action, value: AUTOMATION_RULE_REDACTED_LITERAL };
    })
  };
};

const ruleSchemas = (
  rule: AutomationRuleDbResult,
  schemas: Array<SchemaDbResult | RelationSchemaDbResult>
) => {
  if (rule.schema_id == null) return { schemas, schemaMissing: false };
  const schema = schemas.find(candidate => candidate.id === rule.schema_id);
  return { schemas: schema ? [schema] : [], schemaMissing: schema == null };
};

export const toApiAutomationRule = (
  rule: AutomationRuleDbResult,
  authCtx: WorkspaceAuthorizationContext,
  schemas: Array<SchemaDbResult | RelationSchemaDbResult>
) => {
  const { schemas: candidateSchemas, schemaMissing } = ruleSchemas(rule, schemas);
  const redacted = redactAutomationRule(rule, authCtx, candidateSchemas, schemaMissing);
  return {
    id: redacted.id,
    workspace: redacted.workspace,
    created_by: redacted.created_by,
    name: redacted.name,
    description: redacted.description,
    resource_type: redacted.resource_type,
    schema_id: redacted.schema_id,
    trigger: redacted.trigger,
    conditions: redacted.conditions,
    actions: redacted.actions,
    enabled: redacted.enabled,
    created_at: redacted.created_at.toISOString(),
    updated_at: redacted.updated_at.toISOString()
  };
};

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
  let schemas: Array<SchemaDbResult | RelationSchemaDbResult> = [];
  const hasAccessSensitiveAction = input.actions.some(
    action =>
      action.kind === 'set_field_value' ||
      (action.kind === 'send_notification' && action.recipient.kind === 'reference_owner')
  );
  const hasAccessSensitiveTrigger =
    input.trigger.kind === 'field_changed' || input.trigger.kind === 'relation_field_changed';
  if (input.schema_id != null) {
    const schema =
      input.resource_type === 'relation'
        ? await db.relation.getRelationSchema(workspace, input.schema_id)
        : await db.catalog.getSchema(workspace, input.schema_id);
    httpAssert.true(schema != null, {
      status: 400,
      message: 'Automation rule references an entity type from another workspace'
    });
    if (schema) schemas = [schema];
  } else if (input.conditions.length > 0 || hasAccessSensitiveAction || hasAccessSensitiveTrigger) {
    // Rule isn't scoped to a single schema, so a condition or action field could resolve against
    // any schema in the workspace — check restriction against all of them.
    schemas =
      input.resource_type === 'relation'
        ? await db.relation.listRelationSchemas(workspace)
        : await db.catalog.listSchemas(workspace);
  }
  httpAssert.true(input.actions.length > 0, {
    status: 400,
    message: 'A rule needs at least one action'
  });

  if (input.resource_type === 'relation' && input.trigger.kind === 'lifecycle_transition') {
    httpAssert.true(false, {
      status: 400,
      message: 'Relation automation rules do not support lifecycle transitions'
    });
  }

  if (input.resource_type === 'relation' && input.trigger.kind.startsWith('entity_')) {
    httpAssert.true(false, {
      status: 400,
      message: 'Relation automation rules must use relation triggers'
    });
  }
  if (input.resource_type === 'entity' && input.trigger.kind.startsWith('relation_')) {
    httpAssert.true(false, {
      status: 400,
      message: 'Entity automation rules must use entity triggers'
    });
  }

  if (input.trigger.kind === 'field_changed' || input.trigger.kind === 'relation_field_changed') {
    const triggerField = input.trigger.field;
    const restricted = schemas.some(schema => isFieldViewRestricted(authCtx, schema, triggerField));
    httpAssert.true(!restricted, {
      status: 403,
      statusText: 'Forbidden',
      message: `Automation rule trigger references a restricted field: ${triggerField}`
    });
  }

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
      if (input.resource_type === 'relation' && action.recipient.kind === 'reference_owner') {
        httpAssert.true(false, {
          status: 400,
          message: 'Relation automation rules cannot use reference-owner recipients'
        });
      }
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

  return schemas;
};

export const listAutomationRules = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const { ws, authCtx } = await authorize(db, workspace, event);
  const [entitySchemas, relationSchemas] = await Promise.all([
    db.catalog.listSchemas(ws),
    db.relation?.listRelationSchemas ? db.relation.listRelationSchemas(ws) : Promise.resolve([])
  ]);
  return (await db.automationRule.listRules(ws)).map(rule =>
    toApiAutomationRule(
      rule,
      authCtx,
      rule.resource_type === 'relation' ? relationSchemas : entitySchemas
    )
  );
};

export const createAutomationRule = async (
  db: DatabaseAdapter,
  workspace: string,
  input: AutomationRuleInput,
  event: AuthenticatedEvent
) => {
  const { ws, authCtx } = await authorize(db, workspace, event);
  const schemas = await validateInput(db, ws, input, authCtx);
  const now = new Date();
  const rule = await db.automationRule.createRule({
    id: randomUUID(),
    workspace: ws,
    created_by: authCtx.userId,
    name: input.name,
    description: input.description ?? null,
    resource_type: input.resource_type,
    schema_id: input.schema_id ?? null,
    trigger: input.trigger,
    conditions: input.conditions,
    actions: input.actions,
    enabled: input.enabled,
    created_at: now,
    updated_at: now
  });
  return toApiAutomationRule(rule, authCtx, schemas);
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
  const schemas = await validateInput(db, ws, input, authCtx);
  const updated = await db.automationRule.updateRule(ws, id, {
    name: input.name,
    description: input.description ?? null,
    resource_type: input.resource_type,
    schema_id: input.schema_id ?? null,
    trigger: input.trigger,
    conditions: input.conditions,
    actions: input.actions,
    enabled: input.enabled,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Automation rule not found' });
  return toApiAutomationRule(updated, authCtx, schemas);
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
