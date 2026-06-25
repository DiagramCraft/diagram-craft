import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import {
  EntityFilterPanel,
  type EntityFilterValue
} from '../../../../../components/EntityFilterPanel';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import type { EntityMetricSlateElement } from './types';
import { hasEntityMetricFilter } from './EntityMetric';
import styles from './EntityMetricDialog.module.css';

export const EntityMetricDialog = ({
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
  const el = element as EntityMetricSlateElement;

  const [filter, setFilter] = useState<EntityFilterValue>({
    schemaId: el.schema ?? '',
    owner: el.owner ?? '',
    lifecycle: el.lifecycle ?? ''
  });
  const [label, setLabel] = useState(el.label ?? '');

  const canSave = hasEntityMetricFilter({
    schema: filter.schemaId,
    owner: filter.owner,
    lifecycle: filter.lifecycle
  });

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    if (!canSave) {
      if (isNew) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }

    editor.tf.setNodes(
      {
        schema: filter.schemaId,
        owner: filter.owner,
        lifecycle: filter.lifecycle,
        label
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Entity metric"
      width={460}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Filters">
          <EntityFilterPanel
            value={filter}
            onChange={update => setFilter(prev => ({ ...prev, ...update }))}
          />
        </DialogSection>

        <DialogSection label="Display">
          <div className={styles.options}>
            <label className={styles.optionRow}>
              <span className={styles.optionLabel}>Label</span>
              <div className={styles.optionControl}>
                <input
                  type="text"
                  className={styles.labelInput}
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Services in production"
                />
              </div>
            </label>
          </div>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
