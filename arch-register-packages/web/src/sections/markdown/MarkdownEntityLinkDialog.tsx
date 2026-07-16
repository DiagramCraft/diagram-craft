import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useEntity } from '../../hooks/useEntities';
import { EntityPicker } from '../../components/EntityPicker';
import { DialogContent, DialogSection } from './editor/BlockDialog';

export const MarkdownEntityLinkDialog = ({
  open,
  onClose,
  onConfirm
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (entityId: string) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [selectedEntityId, setSelectedEntityId] = useState('');

  const { data: selectedEntity } = useEntity(workspaceSlug, selectedEntityId);

  const handleClose = () => {
    setSelectedEntityId('');
    onClose();
  };

  const handleConfirm = () => {
    if (!selectedEntityId) return;
    onConfirm(selectedEntityId);
    setSelectedEntityId('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Link entity"
      width={400}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Add', type: 'default', disabled: !selectedEntityId, onClick: handleConfirm }
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
      </DialogContent>
    </Dialog>
  );
};
