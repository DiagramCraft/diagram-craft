import { Dialog } from '@diagram-craft/app-components/Dialog';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { useAuditLog } from '../hooks/useAudit';
import { formatRelativeTime } from '../utils/dateFormat';
import { ENTITY_TYPE_LABELS, OPERATION_LABELS } from '../utils/auditLabels';
import type { RelationRecord } from '@arch-register/api-types/relationContract';

type RelationAuditLogDialogProps = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  relation: RelationRecord | null;
};

export const RelationAuditLogDialog = ({
  open,
  onClose,
  workspaceId,
  relation
}: RelationAuditLogDialogProps) => {
  const { data: auditEntries = [], isLoading } = useAuditLog(
    workspaceId,
    { entityType: 'relation', entityId: relation?._uid ?? null, limit: 50 },
    { enabled: open && !!relation }
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Relation history"
      width="min(560px, calc(100vw - 48px))"
      buttons={[{ label: 'Close', type: 'cancel' as const, onClick: onClose }]}
    >
      {isLoading ? (
        <LoadingState text="Loading activity..." size="sm" />
      ) : auditEntries.length > 0 ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {auditEntries.map(entry => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 12,
                padding: '6px 8px',
                border: '1px solid var(--cmp-border)',
                borderRadius: 6
              }}
            >
              <span className="dim">{formatRelativeTime(entry.timestamp)}</span>
              <span>{entry.user_display_name ?? entry.user_id ?? 'Unknown'}</span>
              <span className="dim">{OPERATION_LABELS[entry.operation]}</span>
              <span className="dim">{ENTITY_TYPE_LABELS[entry.entity_type]}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState compact title="No audit log entries for this relation yet." />
      )}
    </Dialog>
  );
};
