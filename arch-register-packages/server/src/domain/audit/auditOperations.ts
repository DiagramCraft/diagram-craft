import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toApiAuditLogEntry, filterAndPaginateAuditLogs, computeAuditStats } from './auditHelpers';
import { listEntities } from '../catalog/entityOperations';
import { AuditLogEntry, AuditStats } from '@arch-register/api-types/auditContract';

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
    const project = await db.project.getProject(workspace, entry.entity_id);
    return {
      ...entry,
      public_id: project?.public_id ?? null
    };
  }

  if (entry.entity_type === 'content_node') {
    const projectId =
      typeof entry.metadata['project_id'] === 'string' ? entry.metadata['project_id'] : null;
    if (!projectId) return entry;
    const project = await db.project.getProject(workspace, projectId);
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
): Promise<AuditLogEntry[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.audit');

  let entityIds: string[] | null = null;
  if (filters.owner || filters.lifecycle) {
    const matchingEntities = await listEntities(db, ws, null, {
      schemaId: filters.schemaId,
      owner: filters.owner,
      lifecycle: filters.lifecycle
    });
    entityIds = matchingEntities.map(e => e._uid);
  }

  const rows = await db.audit.listAuditLogs(ws);
  const entries = filterAndPaginateAuditLogs(rows, {
    entityType: filters.entityType ?? null,
    entityId: filters.entityId ?? null,
    entityIds,
    schemaId: filters.owner || filters.lifecycle ? null : (filters.schemaId ?? null),
    operation: filters.operation ?? null,
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0
  }).map(entry => toApiAuditLogEntry(entry));

  return await Promise.all(entries.map(entry => resolveAuditPublicIds(db, ws, entry)));
};

export const getAuditStats = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<AuditStats> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.audit');

  const rows = await db.audit.listAuditLogs(ws);
  return computeAuditStats(rows);
};
