import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useContentFile } from '../../../hooks/useContentScope';
import { DocumentPicker } from '../../../components/DocumentPicker';
import { DialogContent, DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import type { WikiLinkSlateElement } from './types';

export const WikiLinkDialog = ({
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

  const [selectedNodeId, setSelectedNodeId] = useState(
    (element as WikiLinkSlateElement).nodeId ?? ''
  );

  const { data: selectedDocument } = useContentFile(workspaceSlug, selectedNodeId);

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!selectedNodeId || !path) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }
    editor.tf.setNodes({ nodeId: selectedNodeId }, { at: path });
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
      title="Wiki page link"
      width={400}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !selectedNodeId, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Wiki page">
          <DocumentPicker
            selectedDocumentId={selectedNodeId}
            selectedDocument={selectedDocument}
            onSelectDocument={document => setSelectedNodeId(document.file.id)}
            onClearDocument={() => setSelectedNodeId('')}
          />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
