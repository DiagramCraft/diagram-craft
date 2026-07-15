import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { EntityPicker } from '../../../../../components/EntityPicker';
import {
  EntityFilterPanel,
  type EntityFilterValue
} from '../../../../../components/EntityFilterPanel';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import { useEntity } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import type { EntityChangelogSlateElement } from './types';
import styles from './EntityChangelogDialog.module.css';

type Mode = 'single' | 'filtered';

const LIMIT_OPTIONS = [
  { value: '10', label: '10 entries' },
  { value: '20', label: '20 entries' },
  { value: '50', label: '50 entries' }
];

const SINCE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last year' },
  { value: '', label: 'All time' }
];

export const EntityChangelogDialog = ({
  element,
  open,
  onClose,
  isNew
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const { workspaceSlug } = useWorkspaceContext();
  const el = element as EntityChangelogSlateElement;

  const initialMode: Mode = el.entityId ? 'single' : 'filtered';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedEntityId, setSelectedEntityId] = useState(el.entityId ?? '');
  const [filter, setFilter] = useState<EntityFilterValue>({
    schemaId: el.schema ?? '',
    owner: el.owner ?? '',
    lifecycle: el.lifecycle ?? ''
  });
  const [limit, setLimit] = useState(el.limit || '10');
  const [since, setSince] = useState(el.since ?? '30d');

  const { data: selectedEntity } = useEntity(workspaceSlug, selectedEntityId);

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    const hasSingleEntity = mode === 'single' && !!selectedEntityId;
    const hasFilter =
      mode === 'filtered' && !!(filter.schemaId || filter.owner || filter.lifecycle);

    if (!hasSingleEntity && !hasFilter) {
      if (isNew) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }

    editor.tf.setNodes(
      {
        entityId: hasSingleEntity ? selectedEntityId : '',
        schema: hasSingleEntity ? '' : filter.schemaId,
        owner: hasSingleEntity ? '' : filter.owner,
        lifecycle: hasSingleEntity ? '' : filter.lifecycle,
        limit,
        since
      },
      { at: path }
    );
    onClose();
  };

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  const hasSingleEntity = mode === 'single' && !!selectedEntityId;
  const hasFilter = mode === 'filtered' && !!(filter.schemaId || filter.owner || filter.lifecycle);
  const canSave = hasSingleEntity || hasFilter;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Entity changelog"
      width={460}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Source">
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={`${styles.modeTab} ${mode === 'single' ? styles.modeTabActive : ''}`}
              onClick={() => setMode('single')}
            >
              Single entity
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${mode === 'filtered' ? styles.modeTabActive : ''}`}
              onClick={() => setMode('filtered')}
            >
              Filtered set
            </button>
          </div>

          {mode === 'single' && (
            <EntityPicker
              selectedEntityId={selectedEntityId}
              selectedEntity={selectedEntity}
              onSelectEntity={entity => setSelectedEntityId(entity._publicId)}
              onClearEntity={() => setSelectedEntityId('')}
            />
          )}

          {mode === 'filtered' && (
            <EntityFilterPanel
              value={filter}
              onChange={update => setFilter(prev => ({ ...prev, ...update }))}
            />
          )}
        </DialogSection>

        <DialogSection label="Options">
          <div className={styles.options}>
            <label className={styles.optionRow}>
              <span className={styles.optionLabel}>Limit</span>
              <select
                className={styles.optionSelect}
                value={limit}
                onChange={e => setLimit(e.target.value)}
              >
                {LIMIT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.optionRow}>
              <span className={styles.optionLabel}>Since</span>
              <select
                className={styles.optionSelect}
                value={since}
                onChange={e => setSince(e.target.value)}
              >
                {SINCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
