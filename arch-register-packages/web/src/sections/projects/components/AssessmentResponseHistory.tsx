import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useAuditLog } from '../../../hooks/useAudit';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import styles from './AssessmentResponseHistory.module.css';
import { formatDateTime } from '../../../utils/dateFormat';
import { EmptyState } from '../../../components/EmptyState';

const OPERATION_LABEL: Record<AuditLogEntry['operation'], string> = {
  create: 'recorded',
  update: 'updated',
  delete: 'deleted'
};


const changedFieldLabels = (entry: AuditLogEntry, assessment: Assessment): string[] => {
  if (entry.operation === 'create') return [];
  const oldValues = (entry.changes.old?.['values'] as Record<string, unknown> | undefined) ?? {};
  const newValues = (entry.changes.new?.['values'] as Record<string, unknown> | undefined) ?? {};
  const fieldIds = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  return [...fieldIds]
    .filter(id => JSON.stringify(oldValues[id]) !== JSON.stringify(newValues[id]))
    .map(id => assessment.fields.find(f => f.id === id)?.label ?? id);
};

export const AssessmentResponseHistory = ({
  workspaceSlug,
  response,
  assessment,
  onClose
}: {
  workspaceSlug: string;
  response: AssessmentResponse;
  assessment: Assessment;
  onClose: () => void;
}) => {
  const { data: entries = [], isLoading } = useAuditLog(workspaceSlug, {
    entityType: 'assessment_response',
    entityId: response.id,
    limit: 100
  });

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title="Response history"
      buttons={[{ type: 'cancel', label: 'Close', onClick: onClose }]}
    >
      {isLoading ? (
        <EmptyState compact title="Loading history..." />
      ) : entries.length === 0 ? (
        <EmptyState compact title="No history recorded yet." />
      ) : (
        <div className={styles.list}>
          {entries.map(entry => (
            <div key={entry.id} className={styles.entry}>
              <div className={styles.entryHead}>
                <span className={styles.entryUser}>
                  {entry.user_display_name ?? 'Unknown user'}
                </span>
                <span className={styles.entryOp}>{OPERATION_LABEL[entry.operation]}</span>
                <span className={styles.entryTime}>{formatDateTime(entry.timestamp)}</span>
              </div>
              <div className={styles.entryFields}>
                {changedFieldLabels(entry, assessment).join(', ') || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
};
