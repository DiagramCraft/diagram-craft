import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../../hooks/useEntities';
import { EntityPicker } from '../../../../../components/EntityPicker';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import type { EntityMentionSlateElement } from './types';

export const EntityMentionDialog = ({
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

  const currentEntityId = (element as EntityMentionSlateElement).entityId ?? '';
  const [selectedEntityId, setSelectedEntityId] = useState(currentEntityId);

  const { data: selectedEntity } = useEntity(workspaceSlug, selectedEntityId);

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!selectedEntityId || !path) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }
    editor.tf.setNodes({ entityId: selectedEntityId }, { at: path });
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
      title="Entity mention"
      width={400}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        {
          label: 'Save',
          type: 'default',
          disabled: !selectedEntityId,
          onClick: handleConfirm
        }
      ]}
    >
      <DialogContent>
        <DialogSection label="Entity">
          <EntityPicker
            selectedEntityId={selectedEntityId}
            selectedEntity={selectedEntity}
            onSelectEntity={entity => {
              setSelectedEntityId(entity._publicId);
            }}
            onClearEntity={() => {
              setSelectedEntityId('');
            }}
          />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
