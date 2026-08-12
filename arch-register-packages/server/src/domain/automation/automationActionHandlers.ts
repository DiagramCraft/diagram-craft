import { randomUUID } from 'node:crypto';
import { PermissionChecker } from '@arch-register/permissions';
import type { AutomationAction } from '@arch-register/api-types/automationRuleContract';
import type { DatabaseAdapter } from '../../db/database';
import type { Entity } from '../catalog/db/catalogDatabase';
import type { RelationDbResult } from '../catalog/db/relationDatabase';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';
import type { AutomationRuleEvent } from './automationRuleEvaluation';
import { buildUserAuthCtx } from '../auth/authorization';
import { isChannelEnabled } from '../notification/notificationPreferences';
import { assertNoExternalEntityFieldWrites } from '../catalog/entityValidation';
import { normalizeEntityRelationFields, relationFields } from '../catalog/dataHelpers';
import { normalizeEntityScalarFields } from '../catalog/entityScalarValues';
import { updateEntityWithAudit, type EntityMutationActor } from '../catalog/entityMutations';
import { RetryableJobError } from '../jobs/jobRetry';
import { computeEntityCompleteness } from '../../utils/completeness';
import { computeChanges, logAudit } from '../audit/db/auditLogging';
import { flattenRelationAuditFields, relationAuditContext } from '../catalog/relationHelpers';
import { canViewRelationNotification } from '../catalog/relationNotificationAccess';
import { withCatalogMutationTransaction } from '../catalog/mutationTransaction';

const checker = new PermissionChecker();

/** The synthesized actor recorded on entity mutations performed by a `set_field_value` action. */
export const AUTOMATION_RULE_SYSTEM_ACTOR: EntityMutationActor = {
  id: 'system:automation-rules',
  displayName: 'Automation rule'
};

export type AutomationActionContext = {
  db: DatabaseAdapter;
  rule: AutomationRuleDbResult;
  action: AutomationAction;
  event: AutomationRuleEvent;
  /** Rule ids that already fired earlier in this causal chain; threaded into any entity update
   *  the action performs so re-entrant rule evaluation can prevent infinite loops. */
  chain: string[];
};

export type AutomationActionHandler = (context: AutomationActionContext) => Promise<void>;

const loadEntity = async (context: AutomationActionContext): Promise<Entity | null> =>
  context.db.catalog.getEntity(context.event.workspace, context.event.entityId);

const loadRelation = async (context: AutomationActionContext): Promise<RelationDbResult | null> =>
  context.db.relation.getRelation(context.event.workspace, context.event.entityId);

const handleCreateAuditNote: AutomationActionHandler = async context => {
  if (context.action.kind !== 'create_audit_note') return;
  const { db, rule, action, event } = context;
  // Written directly via db.audit.createAuditLog (not writeAudit / logAudit): a `create_audit_note`
  // action must not re-trigger webhook delivery, watcher notifications, or another round of
  // automation rule evaluation the way an `entity_type: 'entity'` audit row would.
  await db.audit.createAuditLog({
    workspace: event.workspace,
    timestamp: new Date(),
    user_id: null,
    operation: 'create',
    entity_type: 'automation_note',
    entity_id: event.entityId,
    entity_name: event.entityName,
    entity_slug: event.entitySlug,
    schema_id: event.schemaId,
    changes: { new: { note: action.note } },
    metadata: {
      ruleId: rule.id,
      ruleName: rule.name,
      note: action.note,
      sourceAuditLogId: event.auditLogId,
      resourceType: event.resourceType ?? 'entity',
      relation: event.relation
    }
  });
};

const resolveOwnerTeamRecipients = async (
  db: DatabaseAdapter,
  workspace: string,
  entity: Entity | null
): Promise<string[]> => {
  if (!entity?.owner || !db.workspace?.listTeamAssignments) return [];
  const assignments = await db.workspace.listTeamAssignments(workspace);
  return assignments.filter(a => a.team_id === entity.owner).map(a => a.user_id);
};

const resolveRelationOwnerRecipients = async (
  db: DatabaseAdapter,
  workspace: string,
  relation: RelationDbResult
): Promise<string[]> => {
  const [inEntity, outEntity] = await Promise.all([
    db.catalog.getEntity(workspace, relation.in_entity_id),
    db.catalog.getEntity(workspace, relation.out_entity_id)
  ]);
  const recipients = await Promise.all([
    resolveOwnerTeamRecipients(db, workspace, inEntity),
    resolveOwnerTeamRecipients(db, workspace, outEntity)
  ]);
  return [...new Set(recipients.flat())];
};

const resolveReferenceOwnerRecipients = async (
  db: DatabaseAdapter,
  workspace: string,
  entity: Entity | null,
  fieldId: string
): Promise<string[]> => {
  if (!entity) return [];
  const rawValue = entity.data[fieldId];
  const referencedIds = Array.isArray(rawValue)
    ? rawValue.filter((id): id is string => typeof id === 'string')
    : [];
  if (referencedIds.length === 0) return [];

  const recipients = new Set<string>();
  for (const referencedId of referencedIds) {
    const referenced = await db.catalog.getEntity(workspace, referencedId);
    for (const userId of await resolveOwnerTeamRecipients(db, workspace, referenced)) {
      recipients.add(userId);
    }
  }
  return [...recipients];
};

const handleSendNotification: AutomationActionHandler = async context => {
  if (context.action.kind !== 'send_notification') return;
  const { db, rule, action, event } = context;
  if (!db.notification) return;

  const isRelation = (event.resourceType ?? 'entity') === 'relation';
  const entity = isRelation ? null : await loadEntity(context);
  const relation = isRelation ? await loadRelation(context) : null;
  if (!entity && !relation) return;

  let recipientIds: string[];
  if (action.recipient.kind === 'user') {
    recipientIds = [action.recipient.userId];
  } else if (action.recipient.kind === 'owner_team') {
    recipientIds = relation
      ? await resolveRelationOwnerRecipients(db, event.workspace, relation)
      : await resolveOwnerTeamRecipients(db, event.workspace, entity);
  } else {
    if (!entity) throw new Error('Relation automation rules cannot use reference-owner recipients');
    recipientIds = await resolveReferenceOwnerRecipients(
      db,
      event.workspace,
      entity,
      action.recipient.field
    );
  }

  const uniqueRecipients = [...new Set(recipientIds)];
  const now = new Date();
  const subjectEntity = entity;
  const actionRoute = subjectEntity
    ? `/entities/${encodeURIComponent(subjectEntity.public_id ?? subjectEntity.id)}`
    : null;

  for (const userId of uniqueRecipients) {
    const authCtx = await buildUserAuthCtx(db, event.workspace, userId);
    if (subjectEntity && !checker.hasEntityPermission(authCtx, subjectEntity, 'view_entity'))
      continue;
    if (relation) {
      const endpointEntities = await Promise.all([
        db.catalog.getEntity(event.workspace, relation.in_entity_id),
        db.catalog.getEntity(event.workspace, relation.out_entity_id)
      ]);
      if (
        !endpointEntities.some(
          endpoint => endpoint && checker.hasEntityPermission(authCtx, endpoint, 'view_entity')
        )
      ) {
        continue;
      }
      if (
        !(await canViewRelationNotification(db, event.workspace, authCtx, {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.in_entity_id,
          outEntityId: relation.out_entity_id,
          at: new Date(event.occurredAt),
          owner: relation.owner
        }))
      ) {
        continue;
      }
    }
    if (!(await isChannelEnabled(db, userId, event.workspace, 'automation-rule', 'in_app'))) {
      continue;
    }

    await db.notification.createNotification({
      id: randomUUID(),
      user_id: userId,
      workspace: event.workspace,
      category: 'information',
      event_type: 'automation-rule.notification',
      resource_type: relation ? 'relation' : 'entity',
      resource_id: relation?.id ?? entity!.id,
      case_id: null,
      assignment_id: null,
      actor_user_id: null,
      actor_display_name: 'Automation rule',
      title: relation?.schema_name ?? entity!.name,
      message: action.message,
      action_route: actionRoute,
      presentation_metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        ...(relation ? { relation: relationAuditContext(relation) } : {})
      },
      occurred_at: now,
      delivery_key: `automation-rule:${rule.id}:${event.auditLogId}:user:${userId}`,
      in_app_enabled: true
    });
  }
};

const handleSetFieldValue: AutomationActionHandler = async context => {
  if (context.action.kind !== 'set_field_value') return;
  const { db, action, event, rule, chain } = context;

  if ((event.resourceType ?? 'entity') === 'relation') {
    const relation = await loadRelation(context);
    if (!relation) {
      throw new Error(`Automation rule '${rule.name}' could not find relation '${event.entityId}'`);
    }
    const schema = await db.relation.getRelationSchema(event.workspace, relation.schema_id);
    if (!schema) {
      throw new Error(
        `Automation rule '${rule.name}' could not find relation schema '${relation.schema_id}'`
      );
    }
    const field = schema.fields.find(candidate => candidate.id === action.field);
    if (!field) {
      throw new Error(
        `Automation rule '${rule.name}' references unknown relation field '${action.field}' on schema '${schema.id}'`
      );
    }
    const nextData = { ...relation.data, [action.field]: action.value };
    await db.core.transaction(async tx => {
      const row = await tx.relation.updateRelation(event.workspace, relation.id, {
        data: nextData,
        version: relation.version + 1,
        updated_at: new Date()
      });
      if (!row) {
        throw new Error(
          `Automation rule '${rule.name}' could not update relation '${relation.id}'`
        );
      }
      await logAudit(tx, {
        userId: AUTOMATION_RULE_SYSTEM_ACTOR.id,
        userDisplayName: AUTOMATION_RULE_SYSTEM_ACTOR.displayName,
        workspace: event.workspace,
        operation: 'update',
        entityType: 'relation',
        entityId: relation.id,
        entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
        schemaId: row.schema_id,
        changes: computeChanges(
          flattenRelationAuditFields(relation),
          flattenRelationAuditFields(row)
        ),
        metadata: {
          automationRuleChain: chain,
          source: 'automation-rule',
          ruleId: rule.id,
          relation: relationAuditContext(row)
        }
      });
    });
    return;
  }

  const entity = await loadEntity(context);
  if (!entity) {
    throw new Error(`Automation rule '${rule.name}' could not find entity '${event.entityId}'`);
  }

  const schema = await db.catalog.getSchema(event.workspace, entity.schema_id);
  if (!schema) {
    throw new Error(`Automation rule '${rule.name}' could not find schema '${entity.schema_id}'`);
  }
  const field = schema.fields.find(f => f.id === action.field);
  if (!field) {
    throw new Error(
      `Automation rule '${rule.name}' references unknown field '${action.field}' on schema '${schema.id}'`
    );
  }

  let nextData = { ...entity.data, [action.field]: action.value };

  // set_field_value must go through the same validation any other entity update does: reject
  // writes to external-managed fields, and route relation fields (reference/containment) through
  // the same id-normalization/validation used by ordinary entity updates.
  assertNoExternalEntityFieldWrites(schema.fields, entity.data, nextData);
  if (relationFields([field]).length > 0) {
    const entities = await db.catalog.listEntities(event.workspace);
    nextData = normalizeEntityRelationFields({ schema, fields: nextData, entities });
  }
  const currencyConfig = await db.workspace.getSupportedCurrencies(event.workspace);
  nextData = normalizeEntityScalarFields({
    schemaFields: schema.fields,
    fields: nextData,
    supportedCurrencies: new Set(currencyConfig.currencies.map(currency => currency.code))
  });

  // Threading `automationRuleChain` through `auditMetadata` is what lets `writeAudit` (re-entered
  // by `updateEntityWithAudit` below) know this update is itself the result of a rule firing, so
  // it can refuse to enqueue a rule that's already in the chain instead of looping forever.
  await withCatalogMutationTransaction(db, tx =>
    updateEntityWithAudit(tx, {
      workspace: event.workspace,
      entityId: entity.id,
      previous: entity,
      actor: AUTOMATION_RULE_SYSTEM_ACTOR,
      auditMetadata: { automationRuleChain: chain, source: 'automation-rule', ruleId: rule.id },
      next: {
        slug: entity.slug,
        namespace: entity.namespace,
        name: entity.name,
        description: entity.description,
        owner: entity.owner,
        lifecycle: entity.lifecycle,
        target_lifecycle: entity.target_lifecycle,
        target_lifecycle_date: entity.target_lifecycle_date,
        tags: entity.tags,
        links: entity.links,
        schema_id: entity.schema_id,
        data: nextData,
        project_id: entity.project_id,
        updated_at: new Date(),
        completeness: computeEntityCompleteness(
          {
            description: entity.description,
            owner: entity.owner,
            lifecycle: entity.lifecycle,
            data: nextData
          },
          schema
        )
      }
    })
  );
};

/**
 * Registry of automation rule action handlers, keyed by action kind — same `Map`-based extension
 * pattern as `governanceRegistry.ts`, so new action types can be added without touching a giant
 * switch statement.
 */
export const AUTOMATION_ACTION_HANDLERS: Record<AutomationAction['kind'], AutomationActionHandler> =
  {
    create_audit_note: handleCreateAuditNote,
    send_notification: handleSendNotification,
    set_field_value: handleSetFieldValue
  };

export const runAutomationAction = async (context: AutomationActionContext): Promise<void> => {
  const handler = AUTOMATION_ACTION_HANDLERS[context.action.kind];
  if (!handler) {
    throw new Error(`No handler registered for automation action kind '${context.action.kind}'`);
  }
  try {
    await handler(context);
  } catch (error) {
    if (error instanceof RetryableJobError) throw error;
    throw error instanceof Error
      ? error
      : new Error(`Automation action '${context.action.kind}' failed: ${String(error)}`);
  }
};
