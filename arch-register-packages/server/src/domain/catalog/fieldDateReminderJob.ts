import { randomUUID } from 'node:crypto';
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
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import type { GovernanceRegistry } from '../governance/governanceRegistry';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';
import { parseGovernanceWorkflowConfig } from '../governance/governanceWorkflowConfig';

export const FIELD_DATE_REMINDER_CASE_KIND = 'field-date-reminder';
export const FIELD_DATE_REMINDER_SYSTEM_IDENTITY = 'field-date-reminder';

const FIELD_DATE_REMINDER_SYSTEM_USER_ID = getSystemUserId('governance-deadline-scan-job');

const parseDateValue = (value: unknown): { value: string; dueAt: Date } | null => {
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

const dedupeKeyFor = (entityId: string, fieldId: string) => `${entityId}:${fieldId}`;

const assignmentsFor = (entity: EntityDbResult, teamIds: Set<string>) =>
  entity.owner && teamIds.has(entity.owner)
    ? [
        {
          action: 'acknowledge' as const,
          target: {
            type: 'team_role' as const,
            teamId: entity.owner,
            teamRole: 'team_admin' as const
          }
        }
      ]
    : [
        {
          action: 'acknowledge' as const,
          target: { type: 'capability' as const, capability: 'ent.approve' as const }
        }
      ];

const sameAssignment = (
  current: Awaited<ReturnType<DatabaseAdapter['governance']['listAssignmentsForCase']>>[number],
  desired: ReturnType<typeof assignmentsFor>[number]
) =>
  current.status === 'open' &&
  current.action === desired.action &&
  ((desired.target.type === 'team_role' &&
    current.target_type === 'team_role' &&
    current.target_team_id === desired.target.teamId &&
    current.target_team_role === desired.target.teamRole) ||
    (desired.target.type === 'capability' &&
      current.target_type === 'capability' &&
      current.target_capability === desired.target.capability));

const cancelAutomaticCase = async (
  db: DatabaseAdapter,
  workspace: string,
  caseId: string,
  reason: string,
  now: Date
) =>
  db.core.transaction(async tx => {
    const current = await tx.governance.getCase(workspace, caseId);
    if (current?.status !== 'open') return false;
    const cancelled = await tx.governance.cancelCaseIfOpen(current.id, now);
    if (!cancelled) return false;
    const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(current.id, now);
    await resolveAssignmentNotifications(tx, supersededIds, now);
    await resolveCaseNotifications(tx, current.id, now);
    await recordGovernanceEvent(tx, cancelled, {
      eventType: 'cancelled',
      actorUserId: FIELD_DATE_REMINDER_SYSTEM_USER_ID,
      previousStatus: 'open',
      resultingStatus: 'cancelled',
      reason,
      metadata: { trigger: 'scheduled' }
    });
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
  now: Date
) => {
  const payload = payloadFor(schema, fieldId, dateValue, entity);
  const desiredAssignments = assignmentsFor(entity, teamIds);
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
          target_user_id: null,
          target_team_id: assignment.target.type === 'team_role' ? assignment.target.teamId : null,
          target_team_role:
            assignment.target.type === 'team_role' ? assignment.target.teamRole : null,
          target_capability:
            assignment.target.type === 'capability' ? assignment.target.capability : null,
          created_at: now
        });
      }
    }
    await recordGovernanceEvent(tx, refreshed, {
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
    });
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
  now: Date
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
          assignments: assignmentsFor(entity, teamIds)
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
          now
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
          now
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
        now
      )
    ) {
      cancelled++;
    }
  }

  return { created, refreshed, cancelled };
};

export const createFieldDateReminderGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    [
      FIELD_DATE_REMINDER_CASE_KIND,
      {
        workflowConfig: {
          supportsSubkind: true,
          supportsWorkspaceScope: false,
          supportsApprovals: false,
          supportsReminders: true,
          supportsEscalation: false,
          supportsInitiationFields: false,
          defaultConfig: {
            reminders: {
              enabled: true,
              approachingDays: [3],
              overdueDays: [1, 3]
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
        subjectVisible: async (db, _authCtx, workspace, subjectId) =>
          (await db.catalog.getEntity(workspace, subjectId)) != null,
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
        workspaceReminderOverrides: false
      }
    ]
  ]);
