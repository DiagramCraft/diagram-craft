import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import type {
  DocumentMetadata,
  DocumentType,
  DocumentWorkflowHistoryEvent,
  DocumentWorkflowStatus
} from '@arch-register/api-types/documentContract';
import {
  documentStatusExtensionSchema,
  type GovernanceApprovalConfig,
  type GovernanceEscalationConfig,
  type GovernanceWorkflowConfig,
  type DocumentStatusApproval
} from '@arch-register/api-types/governanceCaseConfigSchemas';
import { requireMarkdownNodeAccess } from '../project/markdownOperationHelpers';
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent,
  resolveAssignmentNotifications,
  resolveCaseNotifications
} from '../governance/governanceOperations';
import type { GovernanceRegistry } from '../governance/governanceRegistry';
import type { GovernanceAssignmentTarget } from '../governance/governanceOperations';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';
import { parseGovernanceWorkflowConfig } from '../governance/governanceWorkflowConfig';
import { resolveApprovalTargets } from '../governance/governanceTargetResolution';

export const DOCUMENT_STATUS_CASE_KIND = 'document.status';
export const DOCUMENT_FIELD_STRATEGY = 'document-field';

type ApproverSlot = {
  type: 'user' | 'team';
  id: string;
  eligibleUserIds: string[];
};

type WorkflowSaveInput = {
  workspace: string;
  nodeId: string;
  documentType: (Pick<DocumentType, 'id' | 'fields'> & { version?: number }) | null;
  currentMetadata: DocumentMetadata;
  nextMetadata: DocumentMetadata;
  changeKind: 'minor' | 'major';
  isNew: boolean;
  initiatorUserId: string;
  sourceRevision: number | null;
  initiationFieldValues?: Record<string, unknown>;
};

const scalarValue = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const valuesOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' && value.length > 0 ? [value] : [];
};

const statusOption = (field: DocumentType['fields'][number], value: string | null) =>
  field.enumOptions?.find(option => option.value === value) ?? null;

type DocumentStatusConfigRow = {
  enabled: boolean;
  updated_at: Date;
  config: GovernanceWorkflowConfig;
};

const approvalFor = (
  field: DocumentType['fields'][number],
  value: string | null,
  config: DocumentStatusConfigRow | undefined
): {
  required: true;
  requiredApprovals: number;
  approverFieldId?: string;
  fallbackUserIds: string[];
  fallbackTeamIds: string[];
} | null => {
  if (field.type !== 'enum' || value == null || !config?.enabled || !config.config.approvals)
    return null;
  const extension = documentStatusExtensionSchema.safeParse(
    config.config.extensions['document.status']
  );
  if (!extension.success || !extension.data.statusesRequiringApprovals.includes(value)) return null;
  return {
    required: true,
    requiredApprovals: config.config.approvals.requiredApprovals,
    approverFieldId:
      config.config.approvals.strategy === DOCUMENT_FIELD_STRATEGY &&
      typeof config.config.approvals.strategyConfig.fieldId === 'string'
        ? config.config.approvals.strategyConfig.fieldId
        : undefined,
    fallbackUserIds: config.config.approvals.fallbackUserIds,
    fallbackTeamIds: config.config.approvals.fallbackTeamIds
  };
};

const loadDocumentStatusConfigs = async (
  db: DatabaseAdapter,
  workspace: string,
  documentTypeId: string
): Promise<Map<string, DocumentStatusConfigRow>> => {
  const rows = await db.governanceCaseConfig.listCaseConfigForKind(
    workspace,
    DOCUMENT_STATUS_CASE_KIND
  );
  const prefix = `${documentTypeId}:`;
  return new Map(
    rows.flatMap(row => {
      if (!row.case_subkind?.startsWith(prefix)) return [];
      const config = parseGovernanceWorkflowConfig(row.config, row.enabled);
      return [[row.case_subkind.slice(prefix.length), { ...row, config }] as const];
    })
  );
};

const unique = <T>(values: T[]) => [...new Set(values)];

/** Counts document types/fields with a workflow-enabled (approval-required) status option. */
export const summarizeDocumentStatusApprovals = (
  documentTypes: Pick<DocumentType, 'id' | 'fields'>[],
  configRows: Array<{
    enabled: boolean;
    case_subkind: string | null;
    config: Record<string, unknown>;
  }>
): { documentTypesConfigured: number; fieldsConfigured: number } => {
  let documentTypesConfigured = 0;
  let fieldsConfigured = 0;
  for (const documentType of documentTypes) {
    const prefix = `${documentType.id}:`;
    const configuredFields = documentType.fields.filter(
      field =>
        field.type === 'enum' &&
        configRows.some(row => {
          if (row.case_subkind !== `${prefix}${field.id}`) return false;
          const config = parseGovernanceWorkflowConfig(row.config, row.enabled);
          const extension = documentStatusExtensionSchema.safeParse(
            config.extensions['document.status']
          );
          return (
            config.approvals != null &&
            extension.success &&
            extension.data.statusesRequiringApprovals.length > 0
          );
        })
    );
    if (configuredFields.length > 0) documentTypesConfigured += 1;
    fieldsConfigured += configuredFields.length;
  }
  return { documentTypesConfigured, fieldsConfigured };
};

const resolveApproverSlots = async (
  db: DatabaseAdapter,
  workspace: string,
  approval: DocumentStatusApproval,
  fields: DocumentType['fields'],
  metadata: DocumentMetadata
): Promise<ApproverSlot[]> => {
  const sourceField = approval.approverFieldId
    ? fields.find(field => field.id === approval.approverFieldId)
    : undefined;
  const sourceValues = sourceField ? valuesOf(metadata[sourceField.id]) : [];
  const strategyTargets =
    sourceField?.type === 'user_link'
      ? sourceValues.map(userId => ({ type: 'user' as const, userId }))
      : sourceField?.type === 'team_link'
        ? sourceValues.map(teamId => ({ type: 'team' as const, teamId }))
        : [];
  const config: GovernanceApprovalConfig = {
    requiredApprovals: approval.requiredApprovals ?? 1,
    strategy: DOCUMENT_FIELD_STRATEGY,
    strategyConfig: approval.approverFieldId ? { fieldId: approval.approverFieldId } : {},
    fallbackUserIds: approval.fallbackUserIds,
    fallbackTeamIds: approval.fallbackTeamIds
  };
  const targets = await resolveApprovalTargets(
    db,
    workspace,
    strategyTargets,
    config,
    approval.requiredApprovals ?? 1
  );

  const [users, teams, memberships] = await Promise.all([
    db.auth.listUsers(),
    db.workspace.listTeams(workspace),
    db.workspace.listTeamAssignments(workspace)
  ]);
  const activeUsers = new Set(users.filter(user => user.is_active).map(user => user.id));
  const teamIdsInWorkspace = new Set(teams.map(team => team.id));
  const slots: ApproverSlot[] = [];

  for (const target of targets) {
    if (target.type === 'user') {
      if (activeUsers.has(target.userId)) {
        slots.push({ type: 'user', id: target.userId, eligibleUserIds: [target.userId] });
      }
      continue;
    }
    if (target.type !== 'team' || !teamIdsInWorkspace.has(target.teamId)) continue;
    const eligibleUserIds = unique(
      memberships
        .filter(item => item.team_id === target.teamId && activeUsers.has(item.user_id))
        .map(item => item.user_id)
    );
    if (eligibleUserIds.length > 0) {
      slots.push({ type: 'team', id: target.teamId, eligibleUserIds });
    }
  }
  return slots;
};

const cancelAndSupersedeRequest = async (
  tx: DatabaseAdapter,
  request: Awaited<ReturnType<DatabaseAdapter['document']['getCurrentWorkflowRequests']>>[number],
  actorUserId: string,
  reason: string
) => {
  const caseRow = await tx.governance.getCase(request.workspace, request.case_id);
  if (caseRow?.status === 'open') {
    const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, new Date());
    if (cancelled) {
      const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(
        caseRow.id,
        new Date()
      );
      await resolveAssignmentNotifications(tx, supersededIds, new Date());
      await resolveCaseNotifications(tx, caseRow.id, new Date());
      await recordGovernanceEvent(tx, cancelled, {
        eventType: 'cancelled',
        actorUserId,
        previousStatus: 'open',
        resultingStatus: 'cancelled',
        reason,
        metadata: { requestId: request.id, superseded: true }
      });
    }
  }
  await tx.document.updateWorkflowRequestStatus(
    request.workspace,
    request.id,
    'superseded',
    new Date()
  );
};

const createStatusRequest = async (
  tx: DatabaseAdapter,
  input: WorkflowSaveInput,
  field: DocumentType['fields'][number],
  previousValue: string | null,
  targetValue: string,
  approval: DocumentStatusApproval,
  configUpdatedAt: Date
) => {
  const slots = await resolveApproverSlots(
    tx,
    input.workspace,
    approval,
    input.documentType!.fields,
    input.nextMetadata
  );
  const requiredApprovals = approval.requiredApprovals ?? 1;
  const requestStatus = slots.length >= requiredApprovals ? 'pending' : 'blocked';

  const requestId = randomUUID();
  const caseId = randomUUID();
  const policyVersion = `${input.documentType!.id}:${input.documentType!.version}:${field.id}:${targetValue}:${configUpdatedAt.toISOString()}`;
  const selfApprovalAllowed =
    requiredApprovals === 1 &&
    slots.length === 1 &&
    slots[0]!.eligibleUserIds.length === 1 &&
    slots[0]!.eligibleUserIds[0] === input.initiatorUserId;
  const resolvedSlots = slots.map(slot => ({
    type: slot.type,
    id: slot.id,
    eligibleUserIds: slot.eligibleUserIds
  }));

  await createGovernanceCaseInTransaction(
    tx,
    input.workspace,
    input.initiatorUserId,
    {
      caseKind: DOCUMENT_STATUS_CASE_KIND,
      caseSubkind: encodeCaseSubkind(input.documentType!.id, field.id),
      subjectType: 'document',
      subjectId: input.nodeId,
      subjectVersion: String(input.sourceRevision ?? ''),
      policyVersion,
      selfApprovalAllowed,
      payload: {
        requestId,
        nodeId: input.nodeId,
        fieldId: field.id,
        previousValue,
        targetValue,
        requiredApprovals,
        resolvedSlots
      },
      initiationFieldValues: input.initiationFieldValues,
      assignments: slots.map(slot =>
        slot.type === 'user'
          ? { action: 'approve' as const, target: { type: 'user' as const, userId: slot.id } }
          : { action: 'approve' as const, target: { type: 'team' as const, teamId: slot.id } }
      )
    },
    new Date(),
    caseId
  );

  await tx.document.createWorkflowRequest({
    id: requestId,
    workspace: input.workspace,
    node_id: input.nodeId,
    field_id: field.id,
    case_id: caseId,
    previous_value: previousValue ?? '',
    target_value: targetValue,
    status: requestStatus,
    required_approvals: requiredApprovals,
    resolved_slots: resolvedSlots,
    policy_snapshot: { approval, policyVersion, selfApprovalAllowed },
    source_revision: input.sourceRevision,
    initiator_user_id: input.initiatorUserId,
    created_at: new Date()
  });
};

export const applyDocumentWorkflowSave = async (
  tx: DatabaseAdapter,
  input: WorkflowSaveInput
): Promise<DocumentMetadata> => {
  if (!input.documentType) return input.nextMetadata;

  const effectiveMetadata = { ...input.nextMetadata };
  const currentRequests = await tx.document.getCurrentWorkflowRequests(
    input.workspace,
    input.nodeId
  );
  const configs = await loadDocumentStatusConfigs(tx, input.workspace, input.documentType.id);

  for (const field of input.documentType.fields.filter(
    field => field.type === 'enum' && !field.retired
  )) {
    const targetValue = scalarValue(input.nextMetadata[field.id]);
    const previousValue = scalarValue(input.currentMetadata[field.id]);
    const config = configs.get(field.id);
    const approval = approvalFor(field, targetValue, config);
    const currentRequest = currentRequests.find(request => request.field_id === field.id);
    const statusChanged = targetValue !== previousValue;
    if (currentRequest && !input.isNew && input.changeKind === 'minor') {
      if (previousValue == null) delete effectiveMetadata[field.id];
      else effectiveMetadata[field.id] = previousValue;
      continue;
    }
    const shouldCreateRequest =
      approval != null && (input.isNew || statusChanged || input.changeKind === 'major');

    if (approval && !shouldCreateRequest && currentRequest?.target_value === targetValue) {
      if (previousValue == null) delete effectiveMetadata[field.id];
      else effectiveMetadata[field.id] = previousValue;
      continue;
    }

    if (currentRequest) {
      await cancelAndSupersedeRequest(
        tx,
        currentRequest,
        input.initiatorUserId,
        'Superseded by a newer document update'
      );
    }

    if (approval && targetValue != null) {
      await createStatusRequest(
        tx,
        input,
        field,
        previousValue,
        targetValue,
        approval,
        config!.updated_at
      );
      if (previousValue == null) delete effectiveMetadata[field.id];
      else effectiveMetadata[field.id] = previousValue;
    }
  }

  return effectiveMetadata;
};

const validateDocumentFieldStrategy = async (
  db: DatabaseAdapter,
  workspace: string,
  subkind: string | null,
  strategy: string,
  strategyConfig: Record<string, unknown>
) => {
  if (strategy !== DOCUMENT_FIELD_STRATEGY) return `Unsupported document strategy '${strategy}'`;
  const fieldId = strategyConfig['fieldId'];
  if (typeof fieldId !== 'string' || fieldId.length === 0) {
    return 'Document field strategies require a user or team field';
  }
  const documentTypeId = subkind?.split(':')[0];
  if (!documentTypeId) return 'Document field strategies require a document type';
  const documentType = await db.document.getDocumentType(workspace, documentTypeId);
  const field = documentType?.fields.find(item => item.id === fieldId);
  if (!field || field.retired || (field.type !== 'user_link' && field.type !== 'team_link')) {
    return `Document field '${fieldId}' must be an active user or team field`;
  }
  return null;
};

const approvedAssignmentIds = (
  events: Awaited<ReturnType<DatabaseAdapter['governance']['listEvents']>>
) =>
  new Set(
    events
      .filter(event => event.event_type === 'approved')
      .map(event => event.metadata['assignmentId'])
  );

export const getDocumentWorkflowStatuses = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  documentType: (Pick<DocumentType, 'id' | 'fields'> & { version?: number }) | null,
  metadata: DocumentMetadata
): Promise<DocumentWorkflowStatus[]> => {
  if (!documentType) return [];
  const requests = await db.document.getCurrentWorkflowRequests(workspace, nodeId);
  const configs = await loadDocumentStatusConfigs(db, workspace, documentType.id);
  return documentType.fields
    .filter(field => field.type === 'enum' && !field.retired && configs.has(field.id))
    .map(async field => {
      const request = requests.find(item => item.field_id === field.id);
      const effectiveValue = scalarValue(metadata[field.id]);
      const config = configs.get(field.id);
      const option = statusOption(field, request?.target_value ?? effectiveValue);
      const approval = approvalFor(field, option?.value ?? null, config);
      const approvalsRequired = request?.required_approvals ?? approval?.requiredApprovals ?? 1;
      if (!request) {
        return {
          fieldId: field.id,
          effectiveValue,
          pendingValue: null,
          requestId: null,
          caseId: null,
          approvalsReceived: 0,
          approvalsRequired,
          state: 'none' as const
        };
      }
      const events = await db.governance.listEvents(request.case_id);
      const approvalsReceived = approvedAssignmentIds(events).size;
      return {
        fieldId: field.id,
        effectiveValue,
        pendingValue: request.target_value,
        requestId: request.id,
        caseId: request.case_id,
        approvalsReceived,
        approvalsRequired,
        state:
          request.status === 'changes_requested'
            ? ('changes_requested' as const)
            : request.status === 'blocked'
              ? ('blocked' as const)
              : ('pending' as const)
      };
    })
    .reduce<Promise<DocumentWorkflowStatus[]>>(
      async (promise, item) => [...(await promise), await item],
      Promise.resolve([])
    );
};

export const listDocumentWorkflowHistory = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  documentType: Pick<DocumentType, 'fields'>,
  event: AuthenticatedEvent
): Promise<DocumentWorkflowHistoryEvent[]> => {
  const node = await db.project.getAnyContentNodeById(workspace, nodeId);
  httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
  await requireMarkdownNodeAccess(
    db,
    workspace,
    await buildApiAuthCtx(db, workspace, event),
    node,
    'read'
  );
  const fieldNames = new Map(documentType.fields.map(field => [field.id, field.name]));
  const requests = await db.document.listWorkflowRequests(workspace, nodeId);
  const result: DocumentWorkflowHistoryEvent[] = [];
  for (const request of requests) {
    for (const item of await db.governance.listEvents(request.case_id)) {
      if (
        item.event_type !== 'approved' &&
        item.event_type !== 'rejected' &&
        item.event_type !== 'admin_override'
      )
        continue;
      result.push({
        id: item.id,
        fieldId: request.field_id,
        fieldName: fieldNames.get(request.field_id) ?? request.field_id,
        eventType: item.event_type,
        actorUserId: item.actor_user_id,
        occurredAt: item.occurred_at.toISOString(),
        reason: item.reason,
        targetValue: request.target_value,
        caseId: request.case_id
      });
    }
  }
  return result.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
};

export const overrideDocumentWorkflow = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  fieldId: string,
  targetValue: string,
  reason: string,
  event: AuthenticatedEvent
): Promise<DocumentWorkflowStatus[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(
    authCtx,
    'ent.override',
    'You do not have permission to override document workflows'
  );
  const node = await db.project.getAnyContentNodeById(ws, nodeId);
  httpAssert.present(node, { status: 404, message: `Markdown document '${nodeId}' not found` });
  await requireMarkdownNodeAccess(db, ws, authCtx, node, 'edit');
  const document = await db.document.getDocumentMetadata(ws, nodeId);
  httpAssert.present(document, {
    status: 409,
    message: 'The governed document metadata is missing'
  });
  const documentType = document.document_type_id
    ? await db.document.getDocumentType(ws, document.document_type_id)
    : null;
  const field = documentType?.fields.find(candidate => candidate.id === fieldId);
  httpAssert.present(field, { status: 400, message: `Workflow field '${fieldId}' not found` });
  const statusConfig = field
    ? (await loadDocumentStatusConfigs(db, ws, document.document_type_id ?? '')).get(fieldId)
    : undefined;
  httpAssert.true(field.type === 'enum' && statusConfig != null, {
    status: 400,
    message: 'Only configured workflow fields can be overridden'
  });
  httpAssert.true(statusOption(field, targetValue) != null, {
    status: 400,
    message: `Unknown status value '${targetValue}'`
  });
  httpAssert.true(reason.trim().length > 0, {
    status: 400,
    message: 'An override reason is required'
  });

  const request = (await db.document.getCurrentWorkflowRequests(ws, nodeId)).find(
    item => item.field_id === fieldId && item.target_value === targetValue
  );
  httpAssert.present(request, {
    status: 409,
    message: 'The requested workflow target is no longer pending'
  });
  const now = new Date();
  await db.core.transaction(async tx => {
    const caseRow = await tx.governance.getCase(ws, request.case_id);
    if (caseRow?.status === 'open') {
      const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
      if (cancelled) {
        const assignmentIds = await tx.governance.supersedeAllOpenAssignmentsForCase(
          caseRow.id,
          now
        );
        await resolveAssignmentNotifications(tx, assignmentIds, now);
        await resolveCaseNotifications(tx, caseRow.id, now);
        await recordGovernanceEvent(tx, cancelled, {
          eventType: 'cancelled',
          actorUserId: authCtx.userId,
          previousStatus: 'open',
          resultingStatus: 'cancelled',
          reason: reason.trim(),
          metadata: { requestId: request.id, fieldId, targetValue }
        });
      }
    }
    const currentCase = await tx.governance.getCase(ws, request.case_id);
    httpAssert.present(currentCase, { status: 409, message: 'The workflow case is missing' });
    await recordGovernanceEvent(tx, currentCase, {
      eventType: 'admin_override',
      actorUserId: authCtx.userId,
      previousStatus: currentCase.status,
      resultingStatus: currentCase.status,
      reason: reason.trim(),
      metadata: { requestId: request.id, fieldId, targetValue }
    });
    await tx.document.upsertDocumentMetadata({
      workspace: document.workspace,
      node_id: document.node_id,
      document_type_id: document.document_type_id,
      values: { ...document.values, [fieldId]: targetValue },
      generated_metadata: document.generated_metadata,
      updated_at: now
    });
    await tx.document.updateWorkflowRequestStatus(ws, request.id, 'approved', now);
  });

  return getDocumentWorkflowStatuses(db, ws, nodeId, documentType, {
    ...document.values,
    [fieldId]: targetValue
  });
};

export const createDocumentGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    [
      DOCUMENT_STATUS_CASE_KIND,
      {
        workflowConfig: {
          supportsSubkind: true,
          supportsWorkspaceScope: false,
          supportsApprovals: true,
          supportsReminders: true,
          supportsEscalation: true,
          approvalStrategies: [
            {
              id: DOCUMENT_FIELD_STRATEGY,
              label: 'Document user/team field',
              configType: 'document-field' as const
            }
          ],
          escalationStrategies: [
            {
              id: DOCUMENT_FIELD_STRATEGY,
              label: 'Document user/team field',
              configType: 'document-field' as const
            }
          ],
          defaultConfig: {
            approvals: {
              requiredApprovals: 1,
              strategy: DOCUMENT_FIELD_STRATEGY,
              strategyConfig: {},
              fallbackUserIds: [],
              fallbackTeamIds: []
            },
            escalation: {
              enabled: false,
              overdueDays: 5,
              strategy: DOCUMENT_FIELD_STRATEGY,
              strategyConfig: {},
              fallbackUserIds: [],
              fallbackTeamIds: []
            },
            extensions: {}
          },
          validateApprovalStrategy: async (db, workspace, subkind, strategy, strategyConfig) =>
            validateDocumentFieldStrategy(db, workspace, subkind, strategy, strategyConfig),
          validateEscalationStrategy: async (db, workspace, subkind, strategy, strategyConfig) =>
            validateDocumentFieldStrategy(db, workspace, subkind, strategy, strategyConfig),
          validateSubkind: async (db, workspace, subkind) => {
            if (!subkind) return 'Document status workflows require a document type and field';
            const [documentTypeId, fieldId] = subkind.split(':');
            if (!documentTypeId || !fieldId || subkind !== `${documentTypeId}:${fieldId}`) {
              return 'Document status workflow subkind must be documentTypeId:fieldId';
            }
            const documentType = await db.document.getDocumentType(workspace, documentTypeId);
            if (!documentType) return `Document type '${documentTypeId}' not found`;
            const field = documentType.fields.find(item => item.id === fieldId);
            if (!field) return `Document field '${fieldId}' not found`;
            if (field.type !== 'enum') return 'Document status workflows require an enum field';
            return null;
          },
          labelSubkind: async (db, workspace, subkind) => {
            if (!subkind) return null;
            const [documentTypeId, fieldId] = subkind.split(':');
            const documentType = documentTypeId
              ? await db.document.getDocumentType(workspace, documentTypeId)
              : null;
            const field = documentType?.fields.find(item => item.id === fieldId);
            return documentType && field ? `${documentType.name} · ${field.name}` : subkind;
          }
        },
        subjectVisible: async (db, authCtx, workspace, subjectId) => {
          const node = await db.project.getAnyContentNodeById(workspace, subjectId);
          if (!node) return false;
          try {
            await requireMarkdownNodeAccess(db, workspace, authCtx, node, 'read');
            return true;
          } catch {
            return false;
          }
        },
        escalation: {
          overdueDays: 5,
          target: async (
            db,
            caseRow,
            config?: GovernanceEscalationConfig
          ): Promise<GovernanceAssignmentTarget[]> => {
            if (config?.strategy !== DOCUMENT_FIELD_STRATEGY) return [];
            const fieldId = config.strategyConfig['fieldId'];
            if (typeof fieldId !== 'string') return [];
            const nodeId = caseRow.payload['nodeId'];
            const documentTypeId = caseRow.case_subkind?.split(':')[0];
            if (typeof nodeId !== 'string' || !documentTypeId) return [];
            const [metadata, documentType] = await Promise.all([
              db.document.getDocumentMetadata(caseRow.workspace, nodeId),
              db.document.getDocumentType(caseRow.workspace, documentTypeId)
            ]);
            const field = documentType?.fields.find(item => item.id === fieldId);
            if (!metadata || !field || field.retired) return [];
            const values = valuesOf(metadata.values[fieldId]);
            return field.type === 'user_link'
              ? values.map(userId => ({ type: 'user' as const, userId }))
              : field.type === 'team_link'
                ? values.map(teamId => ({ type: 'team' as const, teamId }))
                : [];
          }
        },
        beforeDecision: async (tx, { case: caseRow, actorUserId }) => {
          const request = await tx.document.getWorkflowRequestByCase(caseRow.workspace, caseRow.id);
          httpAssert.present(request, {
            status: 409,
            message: 'The document approval request is missing'
          });
          const current = (
            await tx.document.getCurrentWorkflowRequests(caseRow.workspace, request.node_id)
          ).find(item => item.id === request.id);
          httpAssert.present(current, {
            status: 409,
            message: 'This document approval request has been superseded'
          });
          const events = await tx.governance.listEvents(caseRow.id);
          httpAssert.true(
            !events.some(
              event => event.event_type === 'approved' && event.actor_user_id === actorUserId
            ),
            { status: 409, message: 'An approver may only count once for a document request' }
          );
          return 'proceed';
        },
        shouldCompleteCase: async ({ tx, case: caseRow, assignmentId, actorUserId, decision }) => {
          if (decision !== 'approve') return true;
          const request = await tx.document.getWorkflowRequestByCase(caseRow.workspace, caseRow.id);
          httpAssert.present(request, {
            status: 409,
            message: 'The document approval request is missing'
          });
          const events = await tx.governance.listEvents(caseRow.id);
          const approved = events.filter(event => event.event_type === 'approved');
          const actorIds = new Set(approved.map(event => event.actor_user_id).filter(Boolean));
          actorIds.add(actorUserId);
          const slotIds = new Set(approved.map(event => String(event.metadata['assignmentId'])));
          slotIds.add(assignmentId);
          return (
            slotIds.size >= request.required_approvals &&
            actorIds.size >= request.required_approvals
          );
        },
        handleDecision: async (tx, { case: caseRow, decision }) => {
          const request = await tx.document.getWorkflowRequestByCase(caseRow.workspace, caseRow.id);
          if (!request) return;
          if (decision === 'request_changes') {
            await tx.document.updateWorkflowRequestStatus(
              request.workspace,
              request.id,
              'changes_requested'
            );
          } else if (decision === 'reject') {
            await tx.document.updateWorkflowRequestStatus(
              request.workspace,
              request.id,
              'rejected',
              new Date()
            );
          }
        },
        applyDomainEffect: async (tx, { case: caseRow, event }) => {
          const request = await tx.document.getWorkflowRequestByCase(caseRow.workspace, caseRow.id);
          httpAssert.present(request, {
            status: 409,
            message: 'The document approval request is missing'
          });
          const metadata = await tx.document.getDocumentMetadata(
            caseRow.workspace,
            request.node_id
          );
          httpAssert.present(metadata, {
            status: 409,
            message: 'The governed document metadata is missing'
          });
          const nextMetadata = { ...metadata.values, [request.field_id]: request.target_value };
          await tx.document.upsertDocumentMetadata({
            workspace: metadata.workspace,
            node_id: metadata.node_id,
            document_type_id: metadata.document_type_id,
            values: nextMetadata,
            generated_metadata: metadata.generated_metadata,
            updated_at: new Date()
          });
          await tx.document.updateWorkflowRequestStatus(
            request.workspace,
            request.id,
            'approved',
            new Date()
          );
          await recordGovernanceEvent(tx, caseRow, {
            eventType: 'domain_effect_applied',
            actorUserId: event.actor_user_id,
            previousStatus: caseRow.status,
            resultingStatus: caseRow.status,
            reason: null,
            metadata: { requestId: request.id, nodeId: request.node_id, fieldId: request.field_id }
          });
        },
        reminders: { approachingDays: [2], overdueDays: [1, 5] }
      }
    ]
  ]);
