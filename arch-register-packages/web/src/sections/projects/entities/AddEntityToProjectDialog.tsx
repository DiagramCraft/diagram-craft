import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { useEntities } from '../../../hooks/useEntities';
import { useAddProjectEntity } from '../../../hooks/useProjects';
import { useAutoFocus } from '../../../hooks/useAutoFocus';
import { ApiError } from '../../../lib/http';
import styles from './AddEntityToProjectDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  projectEntityTypes: { id: string; label: string }[];
};

export const AddEntityToProjectDialog = ({
  open,
  onClose,
  workspaceId,
  projectId,
  projectEntityTypes
}: Props) => {
  const addEntityMutation = useAddProjectEntity(workspaceId, projectId);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useAutoFocus(searchRef, { enabled: open, delay: 40 });

  const { data: allResults = [] } = useEntities(workspaceId, {
    view: 'summary',
    limit: 200
  });

  const filtered = allResults.filter(e => {
    if (!q.trim()) return true;
    const lower = q.toLowerCase();
    return `${e._name} ${e._slug}`.toLowerCase().includes(lower);
  });

  // Auto-select first result
  useEffect(() => {
    if (filtered.length > 0 && (!selectedId || !filtered.find(e => e._uid === selectedId))) {
      setSelectedId(filtered[0]!._uid);
    }
    if (filtered.length === 0) setSelectedId('');
  }, [filtered, selectedId]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSelectedId('');
      setEntityType('');
      setError('');
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!selectedId) {
      setError('Please select an entity');
      return;
    }
    try {
      await addEntityMutation.mutateAsync({
        entity_id: selectedId,
        entity_type: entityType ?? null
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }, [selectedId, addEntityMutation, onClose, entityType]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!filtered.length) return;
        const idx = filtered.findIndex(e => e._uid === selectedId);
        const next =
          ev.key === 'ArrowDown' ? Math.min(idx + 1, filtered.length - 1) : Math.max(idx - 1, 0);
        setSelectedId(filtered[next]!._uid);
      }
      if (ev.key === 'Enter' && selectedId) {
        ev.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, filtered, selectedId, handleSubmit]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add entity to project"
      width={500}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: addEntityMutation.isPending ? 'Adding...' : 'Add entity',
          type: 'default',
          disabled: addEntityMutation.isPending || !selectedId,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <div className={styles.aedBody}>
        {/* SEARCH */}
        <div className={styles.aedSection}>
          <div className={styles.aedLabel}>Search</div>
          <TextInput
            ref={searchRef}
            variant="search"
            value={q}
            placeholder="Type to search entities…"
            onChange={v => setQ(v ?? '')}
            onClear={() => setQ('')}
            autoComplete="off"
            style={{ width: '100%' }}
          />
        </div>

        {/* ENTITY listbox */}
        <div className={styles.aedSection}>
          <div className={styles.aedLabel}>Entity</div>
          <div className={styles.aedList}>
            {filtered.length === 0 ? (
              <div className={styles.aedListEmpty}>
                {q ? 'No entities match that search.' : 'No entities found.'}
              </div>
            ) : (
              filtered.map(e => (
                <button
                  key={e._uid}
                  type="button"
                  className={`${styles.aedItem} ${selectedId === e._uid ? styles.aedItemSelected : ''}`}
                  onClick={() => setSelectedId(e._uid)}
                >
                  <span className={styles.aedItemName}>{e._name ?? e._slug}</span>
                  <span className={styles.aedItemType}>{e._schema?.name ?? ''}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ROLE */}
        <div className={styles.aedSection}>
          <div className={styles.aedLabel}>Role</div>
          <Select.Root value={entityType} placeholder="None" onChange={v => setEntityType(v ?? '')}>
            <Select.Item value="">None</Select.Item>
            {projectEntityTypes.map(t => (
              <Select.Item key={t.id} value={t.id}>
                {t.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--error-fg)' }}>{error}</div>}
      </div>
    </Dialog>
  );
};
