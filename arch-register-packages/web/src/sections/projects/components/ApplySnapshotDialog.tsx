import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { useEntity } from '../../../hooks/useEntities';
import { useApplySnapshot, useUpdateSnapshot } from '../../../hooks/useSnapshots';
import { findSnapshotConflicts, resolveSnapshotEntityData } from '../projectSnapshotState';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import styles from './ApplySnapshotDialog.module.css';
import { LoadingState } from '../../../components/LoadingState';

type Props = {
  open: boolean;
  snapshot: EntitySnapshot;
  workspaceId: string;
  projectId: string;
  schemas: EntitySchema[];
  onClose: () => void;
};

export const ApplySnapshotDialog = ({ open, snapshot, workspaceId, projectId, schemas, onClose }: Props) => {
  const { data: entity } = useEntity(workspaceId, snapshot.entity_id);
  const applyMutation = useApplySnapshot(workspaceId, snapshot.entity_id, projectId);
  const updateSnapshotMutation = useUpdateSnapshot(workspaceId, snapshot.entity_id);
  const [conflictChoices, setConflictChoices] = useState<Record<string, 'proposed' | 'current'>>({});
  const [targetDate, setTargetDate] = useState(snapshot.target_date ?? '');

  useEffect(() => {
    if (!open) return;
    setConflictChoices({});
    setTargetDate(snapshot.target_date ?? '');
  }, [open, snapshot.target_date]);

  const schema = entity ? schemas.find(s => s.id === entity._schema.id) ?? null : null;

  const proposed = snapshot.proposed_state as Record<string, unknown> | null;
  const base = snapshot.base_state as Record<string, unknown>;
  const conflicts = findSnapshotConflicts(entity, schema, proposed, base);

  const formatVal = (v: unknown) => {
    if (v == null || v === '') return '—';
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  };

  const doApply = async () => {
    if (!entity || !proposed) return;

    const resolved = resolveSnapshotEntityData({ entity, schema, proposed, base, conflictChoices });

    try {
      if ((snapshot.target_date ?? '') !== targetDate) {
        await updateSnapshotMutation.mutateAsync({
          snapshotId: snapshot.id,
          targetDate: targetDate || null
        });
      }

      await applyMutation.mutateAsync({
        snapshotId: snapshot.id,
        resolvedEntityData: resolved
      });
      onClose();
    } catch {
      // Mutations surface their own error state via the existing query/mutation handling.
    }
  };

  const isSubmitting = updateSnapshotMutation.isPending || applyMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply planned change"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: isSubmitting ? 'Applying...' : 'Apply',
          type: 'default',
          disabled: isSubmitting || !entity,
          onClick: doApply
        }
      ]}
    >
      {!entity ? (
        <LoadingState text="Loading entity..." size="sm" />
      ) : (
        <>
          <div className={styles.applySnapshotDateField}>
            <FormElement label="Effective date">
              <DateInput value={targetDate} onChange={value => setTargetDate(value ?? '')} />
            </FormElement>
          </div>
          {conflicts.length === 0 ? (
            <p style={{ margin: 0 }}>
              This will apply all planned changes to the entity. Confirm or adjust the date before applying.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 12px 0' }}>
                The following fields have been changed both in the plan and in the live entity.
                Choose which value to keep for each.
              </p>
              <div className={styles.conflictList}>
                {conflicts.map(c => (
                  <div key={c.key} className={styles.conflictRow}>
                    <div className={styles.conflictLabel}>{c.label}</div>
                    <label className={styles.conflictOption}>
                      <input
                        type="radio"
                        name={`conflict-${c.key}`}
                        checked={(conflictChoices[c.key] ?? 'proposed') === 'proposed'}
                        onChange={() => setConflictChoices(prev => ({ ...prev, [c.key]: 'proposed' }))}
                      />
                      <span className={styles.conflictOptionLabel}>Planned: {formatVal(c.proposedVal)}</span>
                    </label>
                    <label className={styles.conflictOption}>
                      <input
                        type="radio"
                        name={`conflict-${c.key}`}
                        checked={conflictChoices[c.key] === 'current'}
                        onChange={() => setConflictChoices(prev => ({ ...prev, [c.key]: 'current' }))}
                      />
                      <span className={styles.conflictOptionLabel}>Current: {formatVal(c.currentVal)}</span>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Dialog>
  );
};
