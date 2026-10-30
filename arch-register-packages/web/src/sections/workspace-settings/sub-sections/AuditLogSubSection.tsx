import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import styles from './AuditLogSubSection.module.css';
import type { AuditEntityType, AuditOperation } from '@arch-register/api-types/auditContract';
import { useAuditLog } from '../../../hooks/useAudit';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';
import {
  asProjectPublicId,
  projectContentFolderRoute,
  projectDetailRoute
} from '../../../routes/publicObjectRoutes';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { formatRelativeTime } from '../../../utils/dateFormat';
import { LabeledDateInput } from '../../../components/LabeledDateInput';
import { ViewControls } from '../../../components/ViewControls';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { Table } from '../../../components/table/Table';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { ENTITY_TYPE_LABELS, OPERATION_LABELS } from '../../../utils/auditLabels';

const AUDIT_ENTITY_TYPES: Array<{ value: '' | AuditEntityType; label: string }> = [
  { value: '', label: 'All' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'entity_schema', label: 'Schema' },
  { value: 'workspace_field_group', label: 'Shared fieldgroup' },
  { value: 'entity', label: 'Entity' },
  { value: 'workspace_enum', label: 'Enum' },
  { value: 'project', label: 'Project' },
  { value: 'content_node', label: 'Diagram / folder' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'assessment_response', label: 'Assessment response' },
  { value: 'relation_schema', label: 'Relation schema' },
  { value: 'relation', label: 'Relation' },
  { value: 'automation_note', label: 'Automation note' }
];

const AUDIT_OPERATIONS: Array<{ value: '' | AuditOperation; label: string }> = [
  { value: '', label: 'All' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' }
];

const ENTITY_TYPE_TONES: Record<AuditEntityType, string> = {
  workspace: styles.typeWorkspace ?? '',
  entity_schema: styles.typeSchema ?? '',
  workspace_field_group: styles.typeSchema ?? '',
  workspace_enum: styles.typeSchema ?? '',
  entity: styles.typeEntity ?? '',
  project: styles.typeProject ?? '',
  content_node: styles.typeFile ?? '',
  assessment: styles.typeAssessment ?? '',
  assessment_response: styles.typeAssessment ?? '',
  project_milestone: styles.typeAssessment ?? '',
  relation_schema: styles.typeSchema ?? '',
  relation: styles.typeEntity ?? '',
  automation_note: styles.typeAssessment ?? ''
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
  const { openEntityDrawer } = useEntityDrawer();
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
        if (entry.public_id) openEntityDrawer(entry.public_id);
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
    <>
      <div>
        <ViewControls variant="page">
          <LabeledSelect
            label="Object type"
            value={entityType}
            onChange={value => setEntityType(value as '' | AuditEntityType)}
            options={AUDIT_ENTITY_TYPES}
          />
          <LabeledSelect
            label="Action"
            value={operation}
            onChange={value => setOperation(value as '' | AuditOperation)}
            options={AUDIT_OPERATIONS}
          />
          <LabeledDateInput label="From" value={startDate} onChange={setStartDate} />
          <LabeledDateInput label="To" value={endDate} onChange={setEndDate} />
        </ViewControls>

        {loading ? (
          <LoadingState text="Loading activity..." size="sm" />
        ) : entries.length === 0 ? (
          <EmptyState compact title="No audit log entries match the current filters." />
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell width={140}>Object type</Table.HeaderCell>
                <Table.HeaderCell width={120}>When</Table.HeaderCell>
                <Table.HeaderCell width={160}>User</Table.HeaderCell>
                <Table.HeaderCell width={100}>Action</Table.HeaderCell>
                <Table.HeaderCell>Target</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {entries.map(entry => (
                <Table.Row key={entry.id} onClick={() => handleEntryClick(entry)}>
                  <Table.Cell>
                    <span
                      className={`${styles.activityTypeBadge} ${getEntityTypeTone(entry.entity_type)}`}
                    >
                      {getEntityTypeLabel(entry.entity_type)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{formatRelativeTime(entry.timestamp)}</Table.Cell>
                  <Table.Cell>{entry.user_display_name ?? entry.user_id ?? 'Unknown'}</Table.Cell>
                  <Table.Cell>{getOperationLabel(entry.operation)}</Table.Cell>
                  <Table.Cell>{entry.entity_name}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </div>
    </>
  );
};
