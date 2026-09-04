import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { toApiAuditLogEntry, filterAndPaginateAuditLogs, computeAuditStats } from './auditHelpers';
import { listEntities } from '../catalog/entityQueryOperations';
import { parseEntityQuery, buildEntityQueryForExecution } from '../catalog/entityQuery';
import { filterKnownRestrictedFieldGroups } from '../auth/fieldGroupAccessControl';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import { getEntitySchemaAt, getRelationSchemaAt } from '../catalog/schemaHistory';
import { canViewTypedRelation } from '../catalog/relationAccessControl';
import { AuditLogEntry, AuditStats } from '@arch-register/api-types/auditContract';
import type { AuditLogDbResult } from './db/auditDatabase';

// Drops raw `changes` before rows reach a consumer that must never see unredacted field values
// (e.g. aggregate stats). `listAuditLog` is the only place allowed to hold onto `.changes`, and it
// must always run it through `redactAuditEntryChanges` before returning. See
// `auditAccessBoundary.test.ts` for the enforcement of this boundary.
export const stripAuditChanges = (rows: AuditLogDbResult[]): Omit<AuditLogDbResult, 'changes'>[] =>
  rows.map(({ changes, ...rest }) => rest);

export const redactAuditEntryChanges = (
  entry: AuditLogEntry,
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null,
  relationSchema: FieldGroupSchemaShape | null
): AuditLogEntry => {
  if (entry.entity_type !== 'entity' && entry.entity_type !== 'relation') return entry;
  const applicableSchema = entry.entity_type === 'entity' ? schema : relationSchema;
  return {
    ...entry,
    changes: {
      old: entry.changes.old
        ? filterKnownRestrictedFieldGroups(authCtx, applicableSchema, entry.changes.old)
        : entry.changes.old,
      new: entry.changes.new
        ? filterKnownRestrictedFieldGroups(authCtx, applicableSchema, entry.changes.new)
        : entry.changes.new
    }
  };
};

type ResolvedAuditSchemas = {
  schema: FieldGroupSchemaShape | null;
  relationSchema: FieldGroupSchemaShape | null;
};

const relationEndpointIdsFromAuditEntry = (entry: AuditLogDbResult) => {
  const snapshots = [entry.changes.new, entry.changes.old];
  const readId = (key: '_inEntityId' | '_outEntityId') =>
    snapshots
      .map(snapshot => snapshot?.[key])
      .find((value): value is string => typeof value === 'string' && value.length > 0) ?? null;

  const relationContext = entry.metadata['relation'];
  const readContextId = (key: 'in' | 'out') => {
    if (typeof relationContext !== 'object' || relationContext == null) return null;
    const endpoint = (relationContext as Record<string, unknown>)[key];
    if (typeof endpoint !== 'object' || endpoint == null) return null;
    const id = (endpoint as Record<string, unknown>)['id'];
    return typeof id === 'string' && id.length > 0 ? id : null;
  };

  return {
    inEntityId: readId('_inEntityId') ?? readContextId('in'),
    outEntityId: readId('_outEntityId') ?? readContextId('out')
  };
};

// Relation-scoped audit entries get a record-level visibility check (an entry is dropped entirely if
// the viewer can't see one of the relation's endpoint entities) that entity audit entries don't have —
// entity audit visibility is governed only by `ws.audit` plus field-level redaction in
// `redactAuditEntryChanges`. This is an intentional asymmetry (relations can leak owner-restricted
// endpoint entities through their audit trail in a way entities can't leak themselves), not
// duplicated logic to unify: the endpoint resolution and `canViewTypedRelation` check below have no
// entity-side equivalent to share code with.
const resolveRelationAuditSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  entry: AuditLogDbResult,
  authCtx: WorkspaceAuthorizationContext | null
): Promise<ResolvedAuditSchemas | null> => {
  if (!entry.schema_id) return null;

  const relationSchema = await getRelationSchemaAt(db, workspace, entry.schema_id, entry.timestamp);
  if (!relationSchema) return null;

  let { inEntityId, outEntityId } = relationEndpointIdsFromAuditEntry(entry);
  if (!inEntityId || !outEntityId) {
    const relation = await db.relation.getRelation(workspace, entry.entity_id);
    inEntityId ??= relation?.in_entity_id ?? null;
    outEntityId ??= relation?.out_entity_id ?? null;
  }
  if (!inEntityId || !outEntityId) return null;

  const [inEntity, outEntity] = await Promise.all([
    db.catalog.getEntity(workspace, inEntityId),
    db.catalog.getEntity(workspace, outEntityId)
  ]);
  if (!inEntity || !outEntity) return null;

  const [inSchema, outSchema] = await Promise.all([
    getEntitySchemaAt(db, workspace, inEntity.schema_id, entry.timestamp),
    getEntitySchemaAt(db, workspace, outEntity.schema_id, entry.timestamp)
  ]);
  if (!inSchema || !outSchema) return null;

  return canViewTypedRelation(
    authCtx,
    [
      { schema: inSchema, direction: 'in' },
      { schema: outSchema, direction: 'out' }
    ],
    entry.schema_id
  )
    ? { schema: null, relationSchema }
    : null;
};

const resolveAuditSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  entry: AuditLogDbResult,
  authCtx: WorkspaceAuthorizationContext | null
): Promise<ResolvedAuditSchemas | null> => {
  if (entry.entity_type === 'relation') {
    return resolveRelationAuditSchemas(db, workspace, entry, authCtx);
  }

  // Relation automation notes carry the triggering relation's audit context in metadata rather
  // than in changes. Apply the same historical endpoint visibility gate as the source relation;
  // otherwise the note would expose endpoint ids/names through ws.audit.
  const relationMetadata = entry.metadata['relation'];
  if (
    entry.entity_type === 'automation_note' &&
    (entry.metadata['resourceType'] === 'relation' ||
      (typeof relationMetadata === 'object' && relationMetadata != null))
  ) {
    return resolveRelationAuditSchemas(db, workspace, entry, authCtx);
  }

  return {
    schema:
      entry.entity_type === 'entity' && entry.schema_id
        ? await getEntitySchemaAt(db, workspace, entry.schema_id, entry.timestamp)
        : null,
    relationSchema: null
  };
};

const resolveAssessmentResponseEntityName = async (
  db: DatabaseAdapter,
  workspace: string,
  entry: AuditLogEntry
): Promise<AuditLogEntry> => {
  const separator = entry.entity_name.lastIndexOf(' / ');
  const legacySubjectEntityId = separator >= 0 ? entry.entity_name.slice(separator + 3) : null;
  const metadataSubjectEntityId = entry.metadata['subject_entity_id'];
  const subjectEntityId =
    typeof metadataSubjectEntityId === 'string' && metadataSubjectEntityId.length > 0
      ? metadataSubjectEntityId
      : legacySubjectEntityId;

  if (subjectEntityId == null || subjectEntityId.length === 0) return entry;

  const entity = await db.catalog.getEntity(workspace, subjectEntityId);
  if (!entity) return entry;

  const assessmentName = separator >= 0 ? entry.entity_name.slice(0, separator) : entry.entity_name;
  return {
    ...entry,
    entity_name: `${assessmentName} / ${entity.name}`
  };
};

const resolveAuditPublicIds = async (
  db: DatabaseAdapter,
  workspace: string,
  entry: AuditLogEntry
): Promise<AuditLogEntry> => {
  if (entry.entity_type === 'entity') {
    const entity = await db.catalog.getEntity(workspace, entry.entity_id);
    return {
      ...entry,
      public_id: entity?.public_id ?? null
    };
  }

  if (entry.entity_type === 'project') {
    const project = await db.project.projects.getProject(workspace, entry.entity_id);
    return {
      ...entry,
      public_id: project?.public_id ?? null
    };
  }

  if (entry.entity_type === 'content_node') {
    const projectId =
      typeof entry.metadata['project_id'] === 'string' ? entry.metadata['project_id'] : null;
    if (!projectId) return entry;
    const project = await db.project.projects.getProject(workspace, projectId);
    return {
      ...entry,
      metadata: {
        ...entry.metadata,
        project_public_id: project?.public_id ?? null
      }
    };
  }

  if (entry.entity_type === 'assessment_response') {
    return resolveAssessmentResponseEntityName(db, workspace, entry);
  }

  return entry;
};

const listAuditLogForContext = async (
  db: DatabaseAdapter,
  ws: string,
  filters: {
    entityType?: string;
    entityId?: string;
    schemaId?: string;
    owner?: string;
    lifecycle?: string;
    operation?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  },
  authCtx: WorkspaceAuthorizationContext
): Promise<AuditLogEntry[]> => {
  requireWorkspaceCapability(authCtx, 'ws.audit');

  let entityIds: string[] | null = null;
  if (filters.owner || filters.lifecycle) {
    const queryInput = {
      _schemaId: filters.schemaId,
      owner: filters.owner,
      lifecycle: filters.lifecycle
    };
    const matchingEntities = await listEntities(db, ws, null, {
      entityQuery: buildEntityQueryForExecution(queryInput, parseEntityQuery(queryInput))
    });
    entityIds = matchingEntities.map(e => e._uid);
  }

  const rows = await db.audit.listAuditLogs(ws);
  const auditFilters = {
    entityType: filters.entityType ?? null,
    entityId: filters.entityId ?? null,
    entityIds,
    schemaId: filters.owner || filters.lifecycle ? null : (filters.schemaId ?? null),
    operation: filters.operation ?? null,
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null
  };
  const candidateRows = filterAndPaginateAuditLogs(rows, {
    ...auditFilters,
    limit: rows.length,
    offset: 0
  });
  const preparedEntries = (
    await Promise.all(
      candidateRows.map(async rawEntry => {
        const schemas = await resolveAuditSchemas(db, ws, rawEntry, authCtx);
        return schemas ? { rawEntry, schemas } : null;
      })
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry != null);
  const paginatedEntries = preparedEntries.slice(
    filters.offset ?? 0,
    (filters.offset ?? 0) + (filters.limit ?? 50)
  );
  const entries = await Promise.all(
    paginatedEntries.map(async ({ rawEntry, schemas }) => {
      const entry = toApiAuditLogEntry(rawEntry);
      return redactAuditEntryChanges(entry, authCtx, schemas.schema, schemas.relationSchema);
    })
  );

  return await Promise.all(entries.map(entry => resolveAuditPublicIds(db, ws, entry)));
};

export const listAuditLog = async (
  db: DatabaseAdapter,
  workspace: string,
  filters: {
    entityType?: string;
    entityId?: string;
    schemaId?: string;
    owner?: string;
    lifecycle?: string;
    operation?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  },
  event: AuthenticatedEvent
): Promise<AuditLogEntry[]> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: ({ ws, authCtx }) => listAuditLogForContext(db, ws, filters, authCtx)
  });

export const getAuditStats = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<AuditStats> => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.audit');
      const rows = await db.audit.listAuditLogs(ws);
      return computeAuditStats(stripAuditChanges(rows));
    }
  });
};
