import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Banner } from '../components/Banner';
import { TypeBadge } from '../components/TypeBadge';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { resolveSchemaColor } from '../lib/schemaPresentation';
import { useUpdateRelation, useDeleteRelation } from '../hooks/useRelations';
import { useAuditLog } from '../hooks/useAudit';
import { useFieldGroupAccess } from '../auth/useFieldGroupAccess';
import { resolveGroupAccessControl } from '../lib/fieldGroupAccess';
import { RelationFieldInput } from './RelationFieldInput';
import { formatRelativeTime } from '../utils/dateFormat';
import { ENTITY_TYPE_LABELS, OPERATION_LABELS } from '../utils/auditLabels';
import { ApiError } from '../lib/http';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import styles from './AddEntityDialog.module.css';

type RelationDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  relation: RelationRecord | null;
  relationSchema: RelationSchema | undefined;
};

export const RelationDetailDialog = ({
  open,
  onClose,
  workspaceId,
  relation,
  relationSchema
}: RelationDetailDialogProps) => {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && relation && relationSchema) {
      const initial: Record<string, string> = {};
      for (const f of relationSchema.fields) {
        const val = relation[f.id];
        if (val !== undefined && val !== null) initial[f.id] = String(val);
      }
      setFields(initial);
      setDirty(false);
      setError('');
      setConfirmDelete(false);
    }
  }, [open, relation, relationSchema]);

  const getFieldGroupAccess = useFieldGroupAccess(workspaceId);
  const fieldAccessById = useMemo(() => {
    if (!relationSchema) return new Map<string, ReturnType<typeof getFieldGroupAccess>>();
    const groupAccessById = new Map(
      relationSchema.groups.map(group => [
        group.id,
        getFieldGroupAccess(
          resolveGroupAccessControl(group, relationSchema.shared_field_group_links ?? [])
        )
      ])
    );
    return new Map(
      relationSchema.fields.map(f => [
        f.id,
        f.groupId ? (groupAccessById.get(f.groupId) ?? 'edit') : 'edit'
      ])
    );
  }, [relationSchema, getFieldGroupAccess]);

  const updateRelation = useUpdateRelation(workspaceId);
  const deleteRelation = useDeleteRelation(workspaceId);
  const { data: auditEntries = [], isLoading: auditLoading } = useAuditLog(
    workspaceId,
    { entityType: 'relation', entityId: relation?._uid ?? null, limit: 50 },
    { enabled: open && !!relation }
  );

  const setField = (id: string, value: string) => {
    setFields(f => ({ ...f, [id]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!relation || !relationSchema) return;
    setError('');
    const dataFields: Record<string, unknown> = {};
    for (const f of relationSchema.fields) {
      if (f.archived || fieldAccessById.get(f.id) === 'none') continue;
      const val = fields[f.id];
      if (val === undefined || val === '') continue;
      if (f.type === 'boolean') dataFields[f.id] = val === 'true';
      else if (f.type === 'number') dataFields[f.id] = Number(val);
      else dataFields[f.id] = val;
    }
    try {
      await updateRelation.mutateAsync({ relationId: relation._uid, data: dataFields });
      setDirty(false);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save relation');
    }
  };

  const handleDelete = async () => {
    if (!relation) return;
    setConfirmDelete(false);
    try {
      await deleteRelation.mutateAsync({
        relationId: relation._uid,
        inEntityId: relation._in.id,
        outEntityId: relation._out.id
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete relation');
    }
  };

  if (!relation) return null;

  const buttons = [
    { label: 'Close', type: 'cancel' as const, onClick: onClose },
    ...(relation.canDelete
      ? [
          {
            label: 'Delete',
            type: 'danger' as const,
            onClick: () => setConfirmDelete(true)
          }
        ]
      : []),
    ...(relation.canEdit && dirty
      ? [
          {
            label: updateRelation.isPending ? 'Saving...' : 'Save',
            type: 'default' as const,
            disabled: updateRelation.isPending,
            onClick: () => {
              void handleSave();
            }
          }
        ]
      : [])
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Relation details"
        width="min(720px, calc(100vw - 48px))"
        buttons={buttons}
      >
        <div className={styles.form}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TypeBadge
              color={relationSchema ? resolveSchemaColor(relationSchema, 0) : 'var(--accent-fg)'}
              name={relationSchema?.name}
              icon={relationSchema?.icon}
              size={20}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                {relationSchema?.name ?? 'Unknown relation type'}
              </div>
              <div className="dim" style={{ fontSize: 12 }}>
                {relation._in.name} → {relation._out.name}
              </div>
            </div>
          </div>

          {relationSchema && relationSchema.fields.length > 0 && (
            <div className={styles.propertiesList}>
              {relationSchema.fields
                .filter(f => !f.archived && fieldAccessById.get(f.id) !== 'none')
                .map(f => (
                  <RelationFieldInput
                    key={f.id}
                    field={f}
                    value={fields[f.id] ?? ''}
                    onChange={v => setField(f.id, v)}
                    disabled={!relation.canEdit || fieldAccessById.get(f.id) === 'view'}
                  />
                ))}
            </div>
          )}

          {error && <Banner variant="error">{error}</Banner>}

          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Audit trail</div>
            {auditLoading ? (
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
          </div>
        </div>
      </Dialog>
      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete relation?"
        message="This relation instance will be permanently deleted."
        detail="This can't be undone."
        confirmLabel="Delete relation"
        onConfirm={() => {
          void handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};
