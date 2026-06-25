import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import {
  EntityFilterPanel,
  type EntityFilterValue
} from '../../../../../components/EntityFilterPanel';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import type { EntityTableSlateElement } from './types';
import { hasEntityTableFilter } from './EntityTable';
import styles from './EntityTableDialog.module.css';

const LIMIT_OPTIONS = [
  { value: '10', label: '10 rows' },
  { value: '20', label: '20 rows' },
  { value: '50', label: '50 rows' }
];

export const EntityTableDialog = ({
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
  const el = element as EntityTableSlateElement;

  const [filter, setFilter] = useState<EntityFilterValue>({
    schemaId: el.schema ?? '',
    owner: el.owner ?? '',
    lifecycle: el.lifecycle ?? ''
  });
  const [limit, setLimit] = useState(el.limit ?? '10');

  const canSave = hasEntityTableFilter({
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
        limit
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
      title="Entity table"
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

        <DialogSection label="Options">
          <div className={styles.options}>
            <label className={styles.optionRow}>
              <span className={styles.optionLabel}>Limit</span>
              <div className={styles.optionControl}>
                <Select.Root value={limit} onChange={value => setLimit(value ?? '10')}>
                  {LIMIT_OPTIONS.map(option => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Root>
              </div>
            </label>
          </div>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
