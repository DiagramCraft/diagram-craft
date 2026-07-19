import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import styles from './AuditLogSubSection.module.css';
import type { AuditEntityType, AuditOperation } from '@arch-register/api-types/auditContract';
import { useAuditLog } from '../../../hooks/useAudit';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectContentFolderRoute,
  projectDetailRoute
} from '../../../routes/publicObjectRoutes';
import { formatRelativeTime } from '../../../utils/dateFormat';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';

const AUDIT_ENTITY_TYPES: Array<{ value: '' | AuditEntityType; label: string }> = [
  { value: '', label: 'All object types' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'entity_schema', label: 'Schema' },
  { value: 'entity', label: 'Entity' },
  { value: 'project', label: 'Project' },
  { value: 'content_node', label: 'Diagram / folder' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'assessment_response', label: 'Assessment response' }
];

const AUDIT_OPERATIONS: Array<{ value: '' | AuditOperation; label: string }> = [
  { value: '', label: 'All actions' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' }
];

const OPERATION_LABELS: Record<AuditOperation, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted'
};

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  entity: 'entity',
  project: 'project',
  content_node: 'diagram',
  entity_schema: 'schema',
  workspace: 'workspace',
  assessment: 'assessment',
  assessment_response: 'assessment response',
  project_milestone: 'milestone'
};

const ENTITY_TYPE_TONES: Record<AuditEntityType, string> = {
  workspace: styles.typeWorkspace ?? '',
  entity_schema: styles.typeSchema ?? '',
  entity: styles.typeEntity ?? '',
  project: styles.typeProject ?? '',
  content_node: styles.typeFile ?? '',
  assessment: styles.typeAssessment ?? '',
  assessment_response: styles.typeAssessment ?? '',
  project_milestone: styles.typeAssessment ?? ''
};

const getOperationLabel = (operation: AuditOperation): string => OPERATION_LABELS[operation];

const getEntityTypeLabel = (entityType: AuditEntityType): string => ENTITY_TYPE_LABELS[entityType];

const getEntityTypeTone = (entityType: AuditEntityType): string => ENTITY_TYPE_TONES[entityType];

const toInputDate = (value: string | undefined) => value?.slice(0, 10) ?? '';
const toStartOfDay = (date: string) => new Date(`${date}T00:00:00.000Z`).toISOString();
const toEndOfDay = (date: string) => new Date(`${date}T23:59:59.999Z`).toISOString();

export const AuditLogSubSection = ({
  workspace,
  workspaceSlug,
  initialFilters
}: {
  workspace: Workspace;
  workspaceSlug: string;
  initialFilters: {
    entityType?: string;
    operation?: AuditOperation;
    startDate?: string;
    endDate?: string;
  };
}) => {
  const navigate = useNavigate();
  const [entityType, setEntityType] = useState<'' | AuditEntityType>(
    (initialFilters.entityType as AuditEntityType | undefined) ?? ''
  );
  const [operation, setOperation] = useState<'' | AuditOperation>(initialFilters.operation ?? '');
  const [startDate, setStartDate] = useState(toInputDate(initialFilters.startDate));
  const [endDate, setEndDate] = useState(toInputDate(initialFilters.endDate));

  // Use TanStack Query for audit log fetching
  const { data: entries = [], isLoading: loading } = useAuditLog(workspace.url_slug, {
    entityType: entityType ?? null,
    operation: operation ?? null,
    startDate: startDate ? toStartOfDay(startDate) : null,
    endDate: endDate ? toEndOfDay(endDate) : null,
    limit: 100
  });

  const handleEntryClick = (entry: AuditLogEntry) => {
    switch (entry.entity_type) {
      case 'entity':
        if (entry.public_id)
          navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entry.public_id)));
        return;
      case 'project':
        if (entry.public_id) {
          navigate(
            projectDetailRoute(workspaceSlug, asProjectPublicId(entry.public_id), {
              tab: 'projects' as const,
              section: 'home' as const
            })
          );
        }
        return;
      case 'entity_schema':
        navigate({ to: '/$workspaceSlug/settings/schemas', params: { workspaceSlug } });
        return;
      case 'content_node': {
        const projectId =
          typeof entry.metadata['project_public_id'] === 'string'
            ? entry.metadata['project_public_id']
            : null;
        const path = typeof entry.metadata['path'] === 'string' ? entry.metadata['path'] : null;
        const folderFilter = path?.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
        if (projectId) {
          if (folderFilter) {
            navigate(
              projectContentFolderRoute(workspaceSlug, asProjectPublicId(projectId), folderFilter)
            );
          } else {
            navigate(
              projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
                tab: 'projects' as const,
                section: 'home' as const
              })
            );
          }
        }
      }
    }
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.auditFilters}>
        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
            <select
              aria-label="Object type"
              className={styles.input}
              value={entityType}
              onChange={e => setEntityType(e.target.value as '' | AuditEntityType)}
            >
              {AUDIT_ENTITY_TYPES.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <select
              aria-label="Action"
              className={styles.input}
              value={operation}
              onChange={e => setOperation(e.target.value as '' | AuditOperation)}
            >
              {AUDIT_OPERATIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <input
              aria-label="From"
              className={styles.input}
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>

          <label className={styles.filterField}>
            <input
              aria-label="To"
              className={styles.input}
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <div className={`${styles.sectionBody} ${styles.auditSectionBody}`}>
          <div className={styles.activityList}>
            {loading ? (
              <LoadingState text="Loading activity..." size="sm" />
            ) : entries.length > 0 ? (
              entries.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className={styles.activityRow}
                  onClick={() => handleEntryClick(entry)}
                >
                  <span
                    className={`${styles.activityTypeBadge} ${getEntityTypeTone(entry.entity_type)}`}
                  >
                    {getEntityTypeLabel(entry.entity_type)}
                  </span>
                  <span className={styles.activityDate}>{formatRelativeTime(entry.timestamp)}</span>
                  <span className={styles.activityWho}>
                    {entry.user_display_name ?? entry.user_id ?? 'Unknown'}
                  </span>
                  <span className={styles.activityVerb}>{getOperationLabel(entry.operation)}</span>
                  <span className={styles.activityTarget}>{entry.entity_name}</span>
                </button>
              ))
            ) : (
              <EmptyState compact title="No audit log entries match the current filters." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
