import { createHmac, randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuditLogDbResult } from '../audit/db/auditDatabase';
import type {
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from '../governance/db/governanceDatabase';
import type { WebhookOperation } from '@arch-register/api-types/webhookContract';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import { RetryableJobError } from '../jobs/jobRetry';
import {
  filterKnownAllRestrictedFieldGroups,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import { getEntitySchemaAt, getRelationSchemaAt } from '../catalog/schemaHistory';
import type { RelationAuditContext } from '../catalog/relationHelpers';
import { UnsafeOutboundHostError } from './webhookRequest';
import { sendWebhookRequest } from './webhookRequest';

const JOB_TYPE = 'webhook.delivery';
const SYSTEM_IDENTITY = 'webhooks';
const NEVER_ABORTED_SIGNAL = new AbortController().signal;

type WebhookEventBase = {
  version: '1';
  id: string;
  type: string;
  operation: WebhookOperation;
  occurred_at: string;
  workspace_id: string;
  actor: { id: string | null; display_name: string | null };
  changes: AuditLogDbResult['changes'];
  metadata: Record<string, unknown>;
};

type RelationEndpointSchemas = {
  in: FieldGroupSchemaShape | null;
  out: FieldGroupSchemaShape | null;
};

export type WebhookEvent =
  | (WebhookEventBase & {
      type: `entity.${'created' | 'updated' | 'deleted'}`;
      entity: { id: string; name: string; slug: string | null; schema_id: string | null };
      relation?: never;
    })
  | (WebhookEventBase & {
      type: `relation.${'created' | 'updated' | 'deleted'}`;
      entity?: never;
      relation?: RelationAuditContext;
    })
  | (WebhookEventBase & {
      type: `governance.${string}`;
      operation: Extract<WebhookOperation, `governance.${string}`>;
      governance: {
        case: {
          id: string;
          kind: string;
          subject_type: string;
          subject_id: string;
          status: string;
          outcome: string | null;
          external: boolean;
        };
        event: {
          id: string;
          event_type: string;
          previous_status: string | null;
          resulting_status: string | null;
          reason: string | null;
          metadata: Record<string, unknown>;
        };
        assignment_id: string | null;
      };
      entity?: never;
      relation?: never;
    });

const isWebhookVisibleRelationEndpoint = (
  schema: FieldGroupSchemaShape | null,
  relationSchemaId: string,
  direction: 'in' | 'out'
) => {
  if (!schema) return false;

  const fields = schema.fields.filter(field => {
    const candidate = field as Record<string, unknown>;
    return (
      candidate['type'] === 'typedRelation' &&
      candidate['relationSchemaId'] === relationSchemaId &&
      candidate['direction'] === direction
    );
  });

  // An endpoint with no binding retains the legacy relation-schema-only visibility behavior.
  return (
    fields.length === 0 ||
    fields.some(field => {
      if (field.groupId == null) return true;
      const group = (schema.groups ?? []).find(candidate => candidate.id === field.groupId);
      if (!group) return false;
      return !(group.accessControl && group.accessControl.teamIds.length > 0);
    })
  );
};

const isWebhookVisibleRelation = (
  relation: RelationAuditContext,
  endpointSchemas: RelationEndpointSchemas | null
) => {
  // An unbound endpoint is intentionally visible through the legacy relation-schema policy, but a
  // missing endpoint schema has no trustworthy owner-field definition and must fail closed before
  // the endpoint OR is evaluated.
  if (!endpointSchemas?.in || !endpointSchemas.out) return false;
  return (
    isWebhookVisibleRelationEndpoint(endpointSchemas.in, relation.schema.id, 'in') ||
    isWebhookVisibleRelationEndpoint(endpointSchemas.out, relation.schema.id, 'out')
  );
};

const relationContextFromAudit = (auditLog: AuditLogDbResult): RelationAuditContext => {
  const value = auditLog.metadata['relation'];
  if (typeof value === 'object' && value != null) {
    const candidate = value as Partial<RelationAuditContext>;
    if (
      typeof candidate.id === 'string' &&
      candidate.schema != null &&
      typeof candidate.schema.id === 'string' &&
      typeof candidate.schema.name === 'string' &&
      candidate.in != null &&
      typeof candidate.in.id === 'string' &&
      typeof candidate.in.name === 'string' &&
      candidate.out != null &&
      typeof candidate.out.id === 'string' &&
      typeof candidate.out.name === 'string'
    ) {
      return candidate as RelationAuditContext;
    }
  }

  const oldOrNew = auditLog.changes.new ?? auditLog.changes.old ?? {};
  return {
    id: auditLog.entity_id,
    schema: { id: auditLog.schema_id ?? '', name: auditLog.schema_id ?? '' },
    in: { id: String(oldOrNew['_inEntityId'] ?? ''), name: '' },
    out: { id: String(oldOrNew['_outEntityId'] ?? ''), name: '' }
  };
};

// `schema` redacts restricted field-group values from `changes` unconditionally (there is no
// live principal to redact against in the async delivery path) — see
// filterKnownAllRestrictedFieldGroups.
export const auditLogToWebhookEvent = (
  auditLog: AuditLogDbResult,
  schema: FieldGroupSchemaShape | null,
  relationSchema: FieldGroupSchemaShape | null = null,
  relationEndpointSchemas: RelationEndpointSchemas | null = null
): WebhookEvent => {
  const changes = {
    old: auditLog.changes.old
      ? filterKnownAllRestrictedFieldGroups(
          auditLog.entity_type === 'relation' ? relationSchema : schema,
          auditLog.changes.old
        )
      : auditLog.changes.old,
    new: auditLog.changes.new
      ? filterKnownAllRestrictedFieldGroups(
          auditLog.entity_type === 'relation' ? relationSchema : schema,
          auditLog.changes.new
        )
      : auditLog.changes.new
  };
  const relation = auditLog.entity_type === 'relation' ? relationContextFromAudit(auditLog) : null;
  const relationVisible =
    relation != null && isWebhookVisibleRelation(relation, relationEndpointSchemas);
  const metadata = { ...auditLog.metadata };
  if (relation != null && !relationVisible) delete metadata['relation'];
  const base = {
    version: '1' as const,
    id: auditLog.id,
    type: `${auditLog.entity_type}.${auditLog.operation}d` as WebhookEventBase['type'],
    operation: auditLog.operation as WebhookOperation,
    occurred_at: auditLog.timestamp.toISOString(),
    workspace_id: auditLog.workspace,
    actor: { id: auditLog.user_id, display_name: auditLog.user_display_name },
    changes,
    metadata
  };

  if (auditLog.entity_type === 'relation') {
    return relationVisible
      ? {
          ...base,
          type: `${base.type}` as `relation.${'created' | 'updated' | 'deleted'}`,
          relation: relation!
        }
      : {
          ...base,
          type: `${base.type}` as `relation.${'created' | 'updated' | 'deleted'}`
        };
  }
  return {
    ...base,
    type: `${base.type}` as `entity.${'created' | 'updated' | 'deleted'}`,
    entity: {
      id: auditLog.entity_id,
      name: auditLog.entity_name,
      slug: auditLog.entity_slug,
      schema_id: auditLog.schema_id
    }
  };
};

const governanceWebhookOperation = (eventType: GovernanceEventDbResult['event_type']) => {
  switch (eventType) {
    case 'submitted':
      return 'governance.workflow.started' as const;
    case 'approved':
      return 'governance.inbox_item.approved' as const;
    case 'rejected':
      return 'governance.inbox_item.rejected' as const;
    case 'changes_requested':
      return 'governance.inbox_item.changes_requested' as const;
    case 'escalated':
      return 'governance.workflow.escalated' as const;
    case 'finalized':
      return 'governance.workflow.finalized' as const;
    default:
      return null;
  }
};

export const enqueueGovernanceWebhookDeliveries = async (
  db: DatabaseAdapter,
  caseRow: GovernanceCaseDbResult,
  event: GovernanceEventDbResult,
  external: boolean
) => {
  const operation = governanceWebhookOperation(event.event_type);
  if (!operation) return 0;
  const webhooks = await db.webhook.listWebhooks(caseRow.workspace);
  const matching = webhooks.filter(
    webhook => webhook.enabled && webhook.event_filter.operations.includes(operation)
  );
  if (matching.length === 0) return 0;

  const assignmentId =
    typeof event.metadata['assignmentId'] === 'string' ? event.metadata['assignmentId'] : null;
  const webhookEvent: WebhookEvent = {
    version: '1',
    id: event.id,
    type: operation,
    operation,
    occurred_at: event.occurred_at.toISOString(),
    workspace_id: caseRow.workspace,
    actor: { id: event.actor_user_id, display_name: null },
    changes: {},
    metadata: {},
    governance: {
      case: {
        id: caseRow.id,
        kind: caseRow.case_kind,
        subject_type: caseRow.subject_type,
        subject_id: caseRow.subject_id,
        status: caseRow.status,
        outcome: caseRow.outcome,
        external
      },
      event: {
        id: event.id,
        event_type: event.event_type,
        previous_status: event.previous_status,
        resulting_status: event.resulting_status,
        reason: event.reason,
        metadata: event.metadata
      },
      assignment_id: assignmentId
    }
  };

  for (const webhook of matching) {
    await enqueueOneOffJobRun(db, {
      id: randomUUID(),
      workspace: caseRow.workspace,
      jobType: JOB_TYPE,
      systemIdentity: SYSTEM_IDENTITY,
      payload: { webhookId: webhook.id, event: webhookEvent },
      maxAttempts: 5
    });
  }
  return matching.length;
};

export const enqueueWebhookDeliveries = async (db: DatabaseAdapter, auditLog: AuditLogDbResult) => {
  if (auditLog.entity_type !== 'entity' && auditLog.entity_type !== 'relation') return 0;
  const webhooks = await db.webhook.listWebhooks(auditLog.workspace);
  const matching = webhooks.filter(webhook => {
    if (!webhook.enabled || !webhook.event_filter.operations.includes(auditLog.operation)) {
      return false;
    }
    if (auditLog.entity_type === 'entity') {
      return (
        webhook.event_filter.schema_ids.length === 0 ||
        (auditLog.schema_id != null && webhook.event_filter.schema_ids.includes(auditLog.schema_id))
      );
    }
    const relationSchemaIds = webhook.event_filter.relation_schema_ids;
    return (
      relationSchemaIds !== undefined &&
      (relationSchemaIds.length === 0 ||
        (auditLog.schema_id != null && relationSchemaIds.includes(auditLog.schema_id)))
    );
  });
  if (matching.length === 0) return 0;
  let schema: FieldGroupSchemaShape | null = null;
  let relationSchema: FieldGroupSchemaShape | null = null;
  let relationEndpointSchemas: RelationEndpointSchemas | null = null;
  if (auditLog.entity_type === 'entity' && auditLog.schema_id) {
    schema = await getEntitySchemaAt(
      db,
      auditLog.workspace,
      auditLog.schema_id,
      auditLog.timestamp
    );
  } else if (auditLog.entity_type === 'relation' && auditLog.schema_id) {
    const relation = relationContextFromAudit(auditLog);
    const [resolvedRelationSchema, inEntity, outEntity] = await Promise.all([
      getRelationSchemaAt(db, auditLog.workspace, auditLog.schema_id, auditLog.timestamp),
      db.catalog.getEntity(auditLog.workspace, relation.in.id),
      db.catalog.getEntity(auditLog.workspace, relation.out.id)
    ]);
    relationSchema = resolvedRelationSchema;
    const [inSchema, outSchema] = await Promise.all([
      inEntity?.schema_id
        ? getEntitySchemaAt(db, auditLog.workspace, inEntity.schema_id, auditLog.timestamp)
        : Promise.resolve(null),
      outEntity?.schema_id
        ? getEntitySchemaAt(db, auditLog.workspace, outEntity.schema_id, auditLog.timestamp)
        : Promise.resolve(null)
    ]);
    relationEndpointSchemas = { in: inSchema, out: outSchema };
  }
  const event = auditLogToWebhookEvent(auditLog, schema, relationSchema, relationEndpointSchemas);
  for (const webhook of matching) {
    await enqueueOneOffJobRun(db, {
      id: randomUUID(),
      workspace: auditLog.workspace,
      jobType: JOB_TYPE,
      systemIdentity: SYSTEM_IDENTITY,
      payload: { webhookId: webhook.id, event },
      maxAttempts: 5
    });
  }
  return matching.length;
};

const retryAfterMs = (value: string | null, now = Date.now()) => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
};

const isWebhookEvent = (value: unknown): value is WebhookEvent =>
  typeof value === 'object' &&
  value != null &&
  'version' in value &&
  value.version === '1' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'type' in value &&
  typeof value.type === 'string';

export const createWebhookDeliveryHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const signal = context.signal ?? NEVER_ABORTED_SIGNAL;
    const webhookId = context.payload['webhookId'];
    const event = context.payload['event'];
    if (typeof webhookId !== 'string' || !isWebhookEvent(event)) {
      throw new Error('Webhook delivery job has an invalid payload');
    }
    const webhook = await db.webhook.getWebhook(context.workspace, webhookId);
    if (!webhook?.enabled) return { skipped: true };

    const body = JSON.stringify(event);
    const signature = createHmac('sha256', webhook.hmac_secret).update(body).digest('hex');
    let response: Awaited<ReturnType<typeof sendWebhookRequest>>;
    try {
      response = await sendWebhookRequest(new URL(webhook.url), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Arch-Register-Webhooks/1.0',
          'x-arch-register-event': event.type,
          'x-arch-register-event-id': event.id,
          'x-arch-register-delivery-id': context.jobId,
          'x-arch-register-signature-256': `sha256=${signature}`
        },
        body
      });
    } catch (error) {
      if (error instanceof UnsafeOutboundHostError) throw error;
      throw new RetryableJobError(
        `Webhook request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (response.status >= 200 && response.status < 300) {
      return { status_code: response.status };
    }
    const message = `Webhook returned HTTP ${response.status}`;
    if (response.status >= 300 && response.status < 400) {
      throw new Error(message);
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new RetryableJobError(
        message,
        response.status === 429 || response.status === 503
          ? retryAfterMs(response.retryAfter)
          : undefined
      );
    }
    throw new Error(message);
  };
