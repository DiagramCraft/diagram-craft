import { Dialog } from '@diagram-craft/app-components/Dialog';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { useAuditLog } from '../hooks/useAudit';
import { formatRelativeTime } from '../utils/dateFormat';
import { ENTITY_TYPE_LABELS, OPERATION_LABELS } from '../utils/auditLabels';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { RelationHistorySection } from '../sections/relations/RelationHistorySection';

type RelationAuditLogDialogProps = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  relation: RelationRecord | null;
  relationSchema?: RelationSchema;
};

export const RelationAuditLogDialog = ({
  open,
  onClose,
  workspaceId,
  relation,
  relationSchema
}: RelationAuditLogDialogProps) => {
  const { data: auditEntries = [], isLoading } = useAuditLog(
    workspaceId,
    { entityType: 'relation', entityId: relation?._uid ?? null, limit: 50 },
    { enabled: open && !!relation }
  );

  // Without fields of its own a relation has no versions worth listing or restoring.
  const hasFields = !relationSchema || relationSchema.fields.some(f => !f.archived);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Relation history"
      width="min(560px, calc(100vw - 48px))"
      buttons={[{ label: 'Close', type: 'cancel' as const, onClick: onClose }]}
    >
      {open && relation && (
        <>
          {hasFields && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, margin: '0 0 6px' }}>Versions</div>
              <RelationHistorySection
                workspaceSlug={workspaceId}
                relation={relation}
                relationSchema={relationSchema}
              />
            </>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, margin: `${hasFields ? 16 : 0}px 0 6px` }}>
            Activity
          </div>
        </>
      )}
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
