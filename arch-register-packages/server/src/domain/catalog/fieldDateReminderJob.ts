import { randomUUID } from 'node:crypto';
import { fieldDateReminderExtensionSchema } from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { GovernanceEscalationConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { DatabaseAdapter } from '../../db/database';
import { DatabaseError } from '../../db/databaseError';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { listAllCatalogEntities } from './entityLoader';
import { getSystemUserId } from '../auth/systemUsers';
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent,
  resolveAssignmentNotifications,
  resolveCaseNotifications
} from '../governance/governanceOperations';
import type { GovernanceAssignmentTarget } from '../governance/governanceOperations';
import { principalFieldValueToGovernanceTargets } from '../governance/governanceTargetResolution';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import type {
  GovernanceCaseRedactionContext,
  GovernanceEventRedactionContext,
  GovernanceRegistry
} from '../governance/governanceRegistry';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';
import { parseGovernanceWorkflowConfig } from '../governance/governanceWorkflowConfig';
import { updateEntityWithAudit } from './entityMutations';
import { normalizeEntityScalarFields } from './entityScalarValues';
import { getWorkspaceEnumDefinitions } from './enumOptions';
import { computeEntityCompleteness } from '../../utils/completeness';
import { addRetentionDuration, parseIsoDate, toIsoDate } from '../../utils/retentionDate';
import {
  PermissionChecker,
  type AuthorizationContext,
  type WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';

export const ENTITY_PRINCIPAL_FIELD_STRATEGY = 'entity-principal-field';

export const FIELD_DATE_REMINDER_CASE_KIND = 'field-date-reminder';
export const FIELD_DATE_REMINDER_SYSTEM_IDENTITY = 'field-date-reminder';

const FIELD_DATE_REMINDER_SYSTEM_USER_ID = getSystemUserId('governance-deadline-scan-job');
const permissionChecker = new PermissionChecker();

const isEntityAuthorizationContext = (
  authCtx: WorkspaceAuthorizationContext
): authCtx is AuthorizationContext =>
  'schemas' in authCtx && 'entities' in authCtx && 'grants' in authCtx;

const parseDateValue = (value: unknown): { value: string; dueAt: Date } | null => {
  value = Array.isArray(value) ? value[0] : value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dueAt = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(dueAt.getTime()) || dueAt.toISOString().slice(0, 10) !== value
    ? null
    : { value, dueAt };
};

type FieldDateReminderWindows = {
  approachingDays: number[];
  overdueDays: number[];
};

const reminderFor = (
  configs: Map<string, { enabled: boolean; config: Record<string, unknown> }>,
  schemaId: string,
  fieldId: string
): FieldDateReminderWindows | null => {
  const row = configs.get(encodeCaseSubkind(schemaId, fieldId));
  if (!row?.enabled) return null;
  const config = parseGovernanceWorkflowConfig(row.config, row.enabled).reminders;
  if (!config?.enabled) return null;
  return {
    approachingDays: config.approachingDays,
    overdueDays: config.overdueDays
  };
};

const payloadFor = (
  schema: SchemaDbResult,
  fieldId: string,
  dateValue: string,
  entity: EntityDbResult
) => ({
  schemaId: schema.id,
  fieldId,
  fieldName: schema.fields.find(field => field.id === fieldId)?.name ?? fieldId,
  dateValue,
  ownerTeamId: entity.owner
});

const resolveFieldDateSubject = async (db: DatabaseAdapter, caseRow: GovernanceCaseDbResult) => {
  const schemaId = caseRow.payload['schemaId'];
  const fieldId = caseRow.payload['fieldId'];
  if (typeof schemaId !== 'string' || typeof fieldId !== 'string') return null;

  const entity = await db.catalog.getEntity(caseRow.workspace, caseRow.subject_id);
  if (!entity || entity.schema_id !== schemaId) return null;
  const schema = await db.catalog.getSchema(caseRow.workspace, schemaId);
  const field = schema?.fields.find(candidate => candidate.id === fieldId);
  if (!schema || field?.type !== 'date') return null;
  return { entity, schema, fieldId };
};

const canViewFieldDateSubject = async (
  db: DatabaseAdapter,
  authCtx: WorkspaceAuthorizationContext | null,
  caseRow: GovernanceCaseDbResult
) => {
  if (!authCtx) return false;
  const subject = await resolveFieldDateSubject(db, caseRow);
  return (
    subject != null &&
    isEntityAuthorizationContext(authCtx) &&
    permissionChecker.hasEntityPermission(authCtx, subject.entity, 'view_entity') &&
    !isFieldViewRestricted(authCtx, subject.schema, subject.fieldId)
  );
};

const redactFieldDateCasePayload = async ({
  db,
  authCtx,
  caseRow
}: GovernanceCaseRedactionContext): Promise<Record<string, unknown>> => {
  if (await canViewFieldDateSubject(db, authCtx, caseRow)) return caseRow.payload;
  const { dateValue: _dateValue, ...safePayload } = caseRow.payload;
  return safePayload;
};

const redactFieldDateEventMetadata = async ({
  db,
  authCtx,
  caseRow,
  event
}: GovernanceEventRedactionContext): Promise<Record<string, unknown>> => {
  if (await canViewFieldDateSubject(db, authCtx, caseRow)) return event.metadata;
  const { dateValue: _dateValue, ...safeMetadata } = event.metadata;
  return safeMetadata;
};

const dedupeKeyFor = (entityId: string, fieldId: string) => `${entityId}:${fieldId}`;

export const ENTITY_OWNER_STRATEGY = 'entity-owner';

type ReminderRouting = {
  principalFieldId?: string;
  fallbackUserIds: string[];
  fallbackTeamIds: string[];
};

/**
 * Normalizes the standard `approvals` block into reminder routing. `entity-principal-field`
 * routes to a principal field on the record; `entity-owner` (or no config) routes to the owning
 * team. Configured fallback users/teams always apply, and the owning team is the final fallback.
 */
const routingFor = (
  configs: Map<string, { enabled: boolean; config: Record<string, unknown> }>,
  schemaId: string,
  fieldId: string
): ReminderRouting | null => {
  const row = configs.get(encodeCaseSubkind(schemaId, fieldId));
  if (!row?.enabled) return null;
  const approvals = parseGovernanceWorkflowConfig(row.config, row.enabled).approvals;
  if (!approvals) return null;
  const configuredFieldId = approvals.strategyConfig['fieldId'];
  return {
    principalFieldId:
      approvals.strategy === ENTITY_PRINCIPAL_FIELD_STRATEGY &&
      typeof configuredFieldId === 'string'
        ? configuredFieldId
        : undefined,
    fallbackUserIds: approvals.fallbackUserIds,
    fallbackTeamIds: approvals.fallbackTeamIds
  };
};

const completionAdvanceFor = (
  configs: Map<string, { enabled: boolean; config: Record<string, unknown> }>,
  schemaId: string,
  fieldId: string
): { amount: number; unit: 'days' | 'months' | 'years' } | null => {
  const row = configs.get(encodeCaseSubkind(schemaId, fieldId));
  if (!row?.enabled) return null;
  const parsed = fieldDateReminderExtensionSchema.safeParse(
    parseGovernanceWorkflowConfig(row.config, row.enabled).extensions ?? {}
  );
  return parsed.success ? (parsed.data.completionAdvance ?? null) : null;
};

type ReminderAssignmentTarget =
  | { type: 'team_role'; teamId: string; teamRole: 'team_admin' }
  | { type: 'capability'; capability: 'ent.approve' }
  | { type: 'user'; userId: string }
  | { type: 'team'; teamId: string };

type ReminderAssignment = { action: 'acknowledge'; target: ReminderAssignmentTarget };

const ownerFallbackAssignments = (
  entity: EntityDbResult,
  teamIds: Set<string>
): ReminderAssignment[] =>
  entity.owner && teamIds.has(entity.owner)
    ? [
        {
          action: 'acknowledge',
          target: { type: 'team_role', teamId: entity.owner, teamRole: 'team_admin' }
        }
      ]
    : [{ action: 'acknowledge', target: { type: 'capability', capability: 'ent.approve' } }];

const assignmentsFor = (
  entity: EntityDbResult,
  teamIds: Set<string>,
  routing: ReminderRouting | null
): ReminderAssignment[] => {
  if (!routing) return ownerFallbackAssignments(entity, teamIds);

  const candidates: GovernanceAssignmentTarget[] = [
    ...(routing.principalFieldId
      ? principalFieldValueToGovernanceTargets(entity.data[routing.principalFieldId])
      : []),
    ...routing.fallbackUserIds.map(userId => ({ type: 'user' as const, userId })),
    ...routing.fallbackTeamIds.map(teamId => ({ type: 'team' as const, teamId }))
  ].filter(target => target.type !== 'team' || teamIds.has(target.teamId));

  const seen = new Set<string>();
  const deduped = candidates.filter(target => {
    const key = JSON.stringify(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduped.length === 0) return ownerFallbackAssignments(entity, teamIds);
  return deduped.map(target => ({
    action: 'acknowledge',
    target: target as ReminderAssignmentTarget
  }));
};

const sameAssignment = (
  current: Awaited<ReturnType<DatabaseAdapter['governance']['listAssignmentsForCase']>>[number],
  desired: ReminderAssignment
) =>
  current.status === 'open' &&
  current.action === desired.action &&
  ((desired.target.type === 'team_role' &&
    current.target_type === 'team_role' &&
    current.target_team_id === desired.target.teamId &&
    current.target_team_role === desired.target.teamRole) ||
    (desired.target.type === 'capability' &&
      current.target_type === 'capability' &&
      current.target_capability === desired.target.capability) ||
    (desired.target.type === 'user' &&
      current.target_type === 'user' &&
      current.target_user_id === desired.target.userId) ||
    (desired.target.type === 'team' &&
      current.target_type === 'team' &&
      current.target_team_id === desired.target.teamId));

const cancelAutomaticCase = async (
  db: DatabaseAdapter,
  workspace: string,
  caseId: string,
  reason: string,
  now: Date,
  governanceRegistry: GovernanceRegistry
) =>
  db.core.transaction(async tx => {
    const current = await tx.governance.getCase(workspace, caseId);
    if (current?.status !== 'open') return false;
    const cancelled = await tx.governance.cancelCaseIfOpen(current.id, now);
    if (!cancelled) return false;
    const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(current.id, now);
    await resolveAssignmentNotifications(tx, supersededIds, now);
    await resolveCaseNotifications(tx, current.id, now);
    await recordGovernanceEvent(
      tx,
      cancelled,
      {
        eventType: 'cancelled',
        actorUserId: FIELD_DATE_REMINDER_SYSTEM_USER_ID,
        previousStatus: 'open',
        resultingStatus: 'cancelled',
        reason,
        metadata: { trigger: 'scheduled' }
      },
      governanceRegistry
    );
    return true;
  });

const refreshAutomaticCase = async (
  db: DatabaseAdapter,
  current: GovernanceCaseDbResult,
  schema: SchemaDbResult,
  fieldId: string,
  dateValue: string,
  dueAt: Date,
  entity: EntityDbResult,
  teamIds: Set<string>,
  routing: ReminderRouting | null,
  now: Date,
  governanceRegistry: GovernanceRegistry
) => {
  const payload = payloadFor(schema, fieldId, dateValue, entity);
  const desiredAssignments = assignmentsFor(entity, teamIds, routing);
  const currentAssignments = await db.governance.listAssignmentsForCase(current.id);
  const dateChanged = current.payload['dateValue'] !== dateValue;
  const payloadChanged =
    dateChanged ||
    current.payload['fieldName'] !== payload.fieldName ||
    current.payload['ownerTeamId'] !== payload.ownerTeamId;
  const routingChanged =
    currentAssignments.length !== desiredAssignments.length ||
    desiredAssignments.some(
      desired => !currentAssignments.some(existing => sameAssignment(existing, desired))
    );

  if (!dateChanged && !routingChanged && current.payload['fieldName'] === payload.fieldName) return;

  await db.core.transaction(async tx => {
    const fresh = await tx.governance.getCase(current.workspace, current.id);
    if (fresh?.status !== 'open') return;

    const refreshed = payloadChanged
      ? await tx.governance.refreshAutomaticCase(fresh.id, dueAt, payload)
      : fresh;
    if (routingChanged) {
      const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(fresh.id, now);
      await resolveAssignmentNotifications(tx, supersededIds, now);
      for (const assignment of desiredAssignments) {
        await tx.governance.createAssignment({
          id: randomUUID(),
          case_id: fresh.id,
          workspace: fresh.workspace,
          action: assignment.action,
          target_type: assignment.target.type,
          target_user_id: assignment.target.type === 'user' ? assignment.target.userId : null,
          target_team_id:
            assignment.target.type === 'team_role' || assignment.target.type === 'team'
              ? assignment.target.teamId
              : null,
          target_team_role:
            assignment.target.type === 'team_role' ? assignment.target.teamRole : null,
          target_capability:
            assignment.target.type === 'capability' ? assignment.target.capability : null,
          created_at: now
        });
      }
    }
    await recordGovernanceEvent(
      tx,
      refreshed,
      {
        eventType: 'scope_refreshed',
        actorUserId: FIELD_DATE_REMINDER_SYSTEM_USER_ID,
        previousStatus: fresh.status,
        resultingStatus: fresh.status,
        reason: null,
        metadata: {
          trigger: 'scheduled',
          dateChanged,
          routingChanged,
          dateValue
        }
      },
      governanceRegistry
    );
  });
};

const createAutomaticCase = async (
  db: DatabaseAdapter,
  workspace: string,
  schema: SchemaDbResult,
  fieldId: string,
  dateValue: string,
  dueAt: Date,
  entity: EntityDbResult,
  teamIds: Set<string>,
  routing: ReminderRouting | null,
  now: Date,
  governanceRegistry: GovernanceRegistry
) => {
  try {
    await db.core.transaction(async tx => {
      await createGovernanceCaseInTransaction(
        tx,
        workspace,
        FIELD_DATE_REMINDER_SYSTEM_USER_ID,
        {
          caseKind: FIELD_DATE_REMINDER_CASE_KIND,
          caseSubkind: encodeCaseSubkind(schema.id, fieldId),
          dedupeKey: dedupeKeyFor(entity.id, fieldId),
          subjectType: 'entity',
          subjectId: entity.id,
          selfApprovalAllowed: true,
          dueAt,
          payload: payloadFor(schema, fieldId, dateValue, entity),
          skipInitiationFields: true,
          assignments: assignmentsFor(entity, teamIds, routing),
          governanceRegistry
        },
        now
      );
    });
    return true;
  } catch (error) {
    if (!(error instanceof DatabaseError) || error.code !== 'unique') throw error;
    return false;
  }
};

export const syncFieldDateReminderCases = async (
  db: DatabaseAdapter,
  workspace: string,
  now = new Date()
) => {
  const [schemas, entities, teams, existingOpenCases, configRows] = await Promise.all([
    db.catalog.listSchemas(workspace),
    listAllCatalogEntities(db, workspace),
    db.workspace.listTeams(workspace),
    db.governance.listCases(workspace, {
      caseKind: FIELD_DATE_REMINDER_CASE_KIND,
      status: 'open'
    }),
    db.governanceCaseConfig.listCaseConfigForKind(workspace, FIELD_DATE_REMINDER_CASE_KIND)
  ]);
  const schemasById = new Map(schemas.map(schema => [schema.id, schema]));
  const configsBySubkind = new Map(
    configRows
      .filter(row => row.case_subkind != null)
      .map(row => [row.case_subkind!, { enabled: row.enabled, config: row.config }])
  );
  const teamIds = new Set(teams.map(team => team.id));
  const governanceRegistry = createFieldDateReminderGovernanceRegistry();
  const seenKeys = new Set<string>();
  let created = 0;
  let refreshed = 0;
  let cancelled = 0;

  for (const entity of entities) {
    const schema = schemasById.get(entity.schema_id);
    if (!schema) continue;
    for (const field of schema.fields) {
      if (
        field.type !== 'date' ||
        field.archived ||
        !reminderFor(configsBySubkind, schema.id, field.id)
      )
        continue;
      const key = dedupeKeyFor(entity.id, field.id);
      const date = parseDateValue(entity.data[field.id]);
      if (!date) continue;
      seenKeys.add(key);
      const routing = routingFor(configsBySubkind, schema.id, field.id);
      const existing = await db.governance.getCaseByDedupeKey(
        workspace,
        FIELD_DATE_REMINDER_CASE_KIND,
        key
      );
      if (existing?.status === 'open') {
        const before = existing.payload['dateValue'];
        await refreshAutomaticCase(
          db,
          existing,
          schema,
          field.id,
          date.value,
          date.dueAt,
          entity,
          teamIds,
          routing,
          now,
          governanceRegistry
        );
        if (before !== date.value) refreshed++;
        continue;
      }
      if (existing?.status === 'completed' && existing.payload['dateValue'] === date.value) {
        continue;
      }
      if (
        await createAutomaticCase(
          db,
          workspace,
          schema,
          field.id,
          date.value,
          date.dueAt,
          entity,
          teamIds,
          routing,
          now,
          governanceRegistry
        )
      ) {
        created++;
      }
    }
  }

  for (const current of existingOpenCases) {
    if (current.dedupe_key && seenKeys.has(current.dedupe_key)) continue;
    if (
      await cancelAutomaticCase(
        db,
        workspace,
        current.id,
        'The reminder field is no longer active or has no valid date value',
        now,
        governanceRegistry
      )
    ) {
      cancelled++;
    }
  }

  return { created, refreshed, cancelled };
};

const validateFieldReminderStrategy = async (
  db: DatabaseAdapter,
  workspace: string,
  subkind: string | null,
  strategy: string,
  strategyConfig: Record<string, unknown>
) => {
  if (strategy === ENTITY_OWNER_STRATEGY) return null;
  if (strategy !== ENTITY_PRINCIPAL_FIELD_STRATEGY) {
    return `Unsupported strategy '${strategy}'`;
  }
  const fieldId = strategyConfig['fieldId'];
  if (typeof fieldId !== 'string' || fieldId.length === 0) {
    return 'Entity field strategies require a principal field';
  }
  const schemaId = subkind?.split(':')[0];
  if (!schemaId) return 'Entity field strategies require a schema';
  const schema = await db.catalog.getSchema(workspace, schemaId);
  const field = schema?.fields.find(item => item.id === fieldId);
  if (!field || field.archived || field.type !== 'principal') {
    return `Field '${fieldId}' must be an active principal field`;
  }
  return null;
};

/**
 * On acknowledgement of a recurring reminder, advance the triggering date field by the
 * configured interval so the next scan opens a fresh case for the new date.
 */
const advanceTriggeringDateField = async (tx: DatabaseAdapter, caseRow: GovernanceCaseDbResult) => {
  const schemaId = caseRow.payload['schemaId'];
  const fieldId = caseRow.payload['fieldId'];
  const currentValue = caseRow.payload['dateValue'];
  if (
    typeof schemaId !== 'string' ||
    typeof fieldId !== 'string' ||
    typeof currentValue !== 'string'
  ) {
    return;
  }

  const configRow = await tx.governanceCaseConfig.getCaseConfig(
    caseRow.workspace,
    FIELD_DATE_REMINDER_CASE_KIND,
    encodeCaseSubkind(schemaId, fieldId)
  );
  const advance = configRow
    ? completionAdvanceFor(new Map([[configRow.case_subkind ?? '', configRow]]), schemaId, fieldId)
    : null;
  if (!advance) return;

  const start = parseIsoDate(currentValue);
  if (!start) return;
  const nextIso = toIsoDate(addRetentionDuration(start, advance.amount, advance.unit));
  if (nextIso === currentValue) return;

  const entity = await tx.catalog.getEntity(caseRow.workspace, caseRow.subject_id);
  if (!entity) return;
  const schema = await tx.catalog.getSchema(caseRow.workspace, entity.schema_id);
  const field = schema?.fields.find(item => item.id === fieldId);
  if (!schema || !field || field.type !== 'date' || field.archived) return;
  if (entity.data[fieldId] !== currentValue) return;

  const nextData = normalizeEntityScalarFields({
    schemaFields: schema.fields,
    fields: { ...entity.data, [fieldId]: nextIso },
    validateMissing: false,
    enumDefinitions: await getWorkspaceEnumDefinitions(tx, caseRow.workspace),
    previousFields: entity.data
  });

  await updateEntityWithAudit(tx, {
    workspace: caseRow.workspace,
    entityId: entity.id,
    previous: entity,
    actor: { id: FIELD_DATE_REMINDER_SYSTEM_USER_ID, displayName: 'Field date reminder' },
    auditMetadata: {
      governanceCaseId: caseRow.id,
      fieldId,
      previousValue: currentValue,
      nextValue: nextIso
    },
    versionKind: 'case_applied',
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
      project_id: entity.project_id,
      data: nextData,
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
  });
};

const escalationTargetFor = async (
  db: DatabaseAdapter,
  caseRow: GovernanceCaseDbResult,
  config?: GovernanceEscalationConfig
): Promise<GovernanceAssignmentTarget[] | GovernanceAssignmentTarget | null> => {
  const entity = await db.catalog.getEntity(caseRow.workspace, caseRow.subject_id);
  if (!entity) return null;
  const ownerFallback: GovernanceAssignmentTarget | null = entity.owner
    ? { type: 'team_role', teamId: entity.owner, teamRole: 'team_admin' }
    : null;
  if (config?.strategy !== ENTITY_PRINCIPAL_FIELD_STRATEGY) return ownerFallback;
  const fieldId = config.strategyConfig['fieldId'];
  const targets =
    typeof fieldId === 'string' ? principalFieldValueToGovernanceTargets(entity.data[fieldId]) : [];
  return targets.length > 0 ? targets : ownerFallback;
};

export const createFieldDateReminderGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    [
      FIELD_DATE_REMINDER_CASE_KIND,
      {
        workflowConfig: {
          supportsSubkind: true,
          supportsWorkspaceScope: false,
          supportsApprovals: true,
          supportsReminders: true,
          supportsEscalation: true,
          supportsInitiationFields: false,
          approvalStrategies: [
            {
              id: ENTITY_PRINCIPAL_FIELD_STRATEGY,
              label: 'Record user/team field',
              configType: 'document-field' as const
            },
            { id: ENTITY_OWNER_STRATEGY, label: 'Owning team', configType: 'none' as const }
          ],
          escalationStrategies: [
            {
              id: ENTITY_PRINCIPAL_FIELD_STRATEGY,
              label: 'Record user/team field',
              configType: 'document-field' as const
            },
            { id: ENTITY_OWNER_STRATEGY, label: 'Owning team', configType: 'none' as const }
          ],
          validateApprovalStrategy: async (db, workspace, subkind, strategy, strategyConfig) =>
            validateFieldReminderStrategy(db, workspace, subkind, strategy, strategyConfig),
          validateEscalationStrategy: async (db, workspace, subkind, strategy, strategyConfig) =>
            validateFieldReminderStrategy(db, workspace, subkind, strategy, strategyConfig),
          validateConfig: config => {
            fieldDateReminderExtensionSchema.parse(config.extensions ?? {});
          },
          defaultConfig: {
            reminders: {
              enabled: true,
              approachingDays: [3],
              overdueDays: [1, 3]
            },
            approvals: {
              requiredApprovals: 1,
              strategy: ENTITY_OWNER_STRATEGY,
              strategyConfig: {},
              fallbackUserIds: [],
              fallbackTeamIds: []
            },
            escalation: {
              enabled: false,
              overdueDays: 14,
              strategy: ENTITY_OWNER_STRATEGY,
              strategyConfig: {},
              fallbackUserIds: [],
              fallbackTeamIds: []
            },
            extensions: {}
          },
          validateSubkind: async (db, workspace, subkind) => {
            if (!subkind) return 'Field reminders require a schema and field';
            const [schemaId, fieldId] = subkind.split(':');
            if (!schemaId || !fieldId || subkind !== `${schemaId}:${fieldId}`) {
              return 'Field reminder subkind must be schemaId:fieldId';
            }
            const schema = await db.catalog.getSchema(workspace, schemaId);
            if (!schema) return `Schema '${schemaId}' not found`;
            const field = schema.fields.find(item => item.id === fieldId);
            return field?.type === 'date' ? null : `Date field '${fieldId}' not found`;
          },
          labelSubkind: async (db, workspace, subkind) => {
            if (!subkind) return null;
            const [schemaId, fieldId] = subkind.split(':');
            const schema = schemaId ? await db.catalog.getSchema(workspace, schemaId) : null;
            const field = schema?.fields.find(item => item.id === fieldId);
            return schema && field ? `${schema.name} · ${field.name}` : subkind;
          }
        },
        caseVisible: (db, authCtx, caseRow) => canViewFieldDateSubject(db, authCtx, caseRow),
        subjectVisible: async (db, authCtx, workspace, subjectId) => {
          const entity = await db.catalog.getEntity(workspace, subjectId);
          return (
            entity != null && permissionChecker.hasEntityPermission(authCtx, entity, 'view_entity')
          );
        },
        redactCasePayload: redactFieldDateCasePayload,
        redactEventMetadata: redactFieldDateEventMetadata,
        resolveReminderWindows: async (db, caseRow) => {
          const schemaId = caseRow.payload['schemaId'];
          const fieldId = caseRow.payload['fieldId'];
          if (typeof schemaId !== 'string' || typeof fieldId !== 'string') return null;
          const row = await db.governanceCaseConfig.getCaseConfig(
            caseRow.workspace,
            FIELD_DATE_REMINDER_CASE_KIND,
            encodeCaseSubkind(schemaId, fieldId)
          );
          return reminderFor(
            row ? new Map([[row.case_subkind ?? '', row]]) : new Map(),
            schemaId,
            fieldId
          );
        },
        workspaceReminderOverrides: false,
        escalation: {
          overdueDays: 14,
          target: escalationTargetFor
        },
        applyDomainEffect: async (tx, { case: caseRow }) => {
          await advanceTriggeringDateField(tx, caseRow);
        }
      }
    ]
  ]);
