import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { EntityPicker } from '../../../../../components/EntityPicker';
import { useEntity } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import {
  normalizeEntityGraphDepth,
  normalizeEntityGraphDirection,
  type EntityGraphDirection,
  type EntityGraphSlateElement
} from './types';
import styles from './EntityGraphDialog.module.css';

export const EntityGraphDialog = ({
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
  const current = element as EntityGraphSlateElement;
  const [selectedEntityId, setSelectedEntityId] = useState(current.entityId ?? '');
  const [depth, setDepth] = useState(normalizeEntityGraphDepth(current.depth));
  const [direction, setDirection] = useState<EntityGraphDirection>(
    normalizeEntityGraphDirection(current.direction)
  );
  const { data: selectedEntity } = useEntity(workspaceSlug, selectedEntityId);

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    if (!selectedEntityId) {
      if (isNew) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }

    editor.tf.setNodes({ entityId: selectedEntityId, depth, direction }, { at: path });
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
      title="Entity graph"
      width={440}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !selectedEntityId, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Entity">
          <EntityPicker
            selectedEntityId={selectedEntityId}
            selectedEntity={selectedEntity}
            onSelectEntity={entity => setSelectedEntityId(entity._publicId)}
            onClearEntity={() => setSelectedEntityId('')}
          />
        </DialogSection>

        <DialogSection label="Options">
          <div className={styles.options}>
            <label className={styles.option}>
              <span className={styles.optionLabel}>Depth</span>
              <NumberInput
                value={depth}
                min={1}
                max={3}
                step={1}
                onChange={value => setDepth(normalizeEntityGraphDepth(value))}
                style={{ width: '64px' }}
              />
            </label>
            <label className={styles.option}>
              <span className={styles.optionLabel}>Direction</span>
              <Select.Root
                value={direction}
                onChange={value => setDirection(normalizeEntityGraphDirection(value))}
              >
                <Select.Item value="both">Both directions</Select.Item>
                <Select.Item value="upstream">Upstream dependencies</Select.Item>
                <Select.Item value="downstream">Downstream impact</Select.Item>
              </Select.Root>
            </label>
          </div>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
