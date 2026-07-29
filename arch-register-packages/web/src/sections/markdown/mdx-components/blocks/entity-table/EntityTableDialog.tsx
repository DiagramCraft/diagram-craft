import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogContent } from '../../../editor/BlockDialog';
import { EntityTableConfigForm } from './EntityTableConfigForm';
import type { EntityTableFilterState, EntityTableSlateElement } from './types';

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

  const [state, setState] = useState<EntityTableFilterState>({
    schemaId: el.schema ?? '',
    owner: el.owner ?? '',
    lifecycle: el.lifecycle ?? '',
    limit: el.limit ?? '10'
  });

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    editor.tf.setNodes(
      {
        schema: state.schemaId,
        owner: state.owner,
        lifecycle: state.lifecycle,
        limit: state.limit
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
        { label: 'Save', type: 'default', onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <EntityTableConfigForm
          value={state}
          onChange={update => setState(prev => ({ ...prev, ...update }))}
        />
      </DialogContent>
    </Dialog>
  );
};
