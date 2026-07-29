import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import { useSavedViews } from '../../../../../hooks/useSavedViews';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import type { EntityViewEmbedSlateElement } from './types';
import { SavedViewSelectField } from './SavedViewSelectField';

export const EntityViewEmbedDialog = ({
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
  const el = element as EntityViewEmbedSlateElement;
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const [viewId, setViewId] = useState(el.viewId ?? '');

  const { data: savedViews = [] } = useSavedViews(
    workspaceSlug,
    projectId ? { projectId, includeWorkspace: true } : undefined
  );
  // Only admin-flagged views can be embedded in wiki pages (prevents personal/draft views from appearing)
  const adminViews = savedViews.filter(v => v.isAdminView);

  const canSave = !!viewId;

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

    editor.tf.setNodes({ viewId }, { at: path });
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
      title="Entity view"
      width={460}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="View">
          <SavedViewSelectField adminViews={adminViews} value={viewId} onChange={setViewId} />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
