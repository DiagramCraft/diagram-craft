import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useContentFile } from '../../hooks/useContentScope';
import { DocumentPicker } from '../../components/DocumentPicker';
import { DialogContent, DialogSection } from './editor/BlockDialog';

export const MarkdownDocumentLinkDialog = ({
  open,
  onClose,
  onConfirm
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (fileId: string) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [selectedDocumentId, setSelectedDocumentId] = useState('');

  const { data: selectedDocument } = useContentFile(workspaceSlug, selectedDocumentId);

  const handleClose = () => {
    setSelectedDocumentId('');
    onClose();
  };

  const handleConfirm = () => {
    if (!selectedDocumentId) return;
    onConfirm(selectedDocumentId);
    setSelectedDocumentId('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Link document"
      width={400}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Add', type: 'default', disabled: !selectedDocumentId, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Document">
          <DocumentPicker
            selectedDocumentId={selectedDocumentId}
            selectedDocument={selectedDocument}
            onSelectDocument={document => setSelectedDocumentId(document.fileId)}
            onClearDocument={() => setSelectedDocumentId('')}
          />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
