import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { useParams } from '@tanstack/react-router';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntityContentNodes } from '../../../../../hooks/useProjects';
import {
  useProjectFiles,
  useWorkspaceContentNodes
} from '../../../../../hooks/useProjectFiles';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import { DiagramPicker } from '../../../../../components/DiagramPicker';
import type { DiagramEmbedSlateElement } from './types';
import styles from './DiagramEmbedDialog.module.css';

export const DiagramEmbedDialog = ({
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
  const params = useParams({ strict: false }) as {
    projectId?: string;
    entityId?: string;
  };
  const { projectId, entityId } = params;

  const el = element as DiagramEmbedSlateElement;
  const [fileId, setFileId] = useState(el.fileId ?? '');
  const [caption, setCaption] = useState(el.caption ?? '');

  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', {
    enabled: !!entityId
  });
  // useProjectFiles is naturally disabled when projectId is '' (its own enabled guard)
  const { data: projectFiles } = useProjectFiles(workspaceSlug, projectId ?? '');
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, {
    enabled: !projectId && !entityId
  });

  const fileTree: FileTree | undefined = entityId
    ? entityFiles
    : projectId
      ? projectFiles
      : workspaceFiles;

  const handleSelectFile = (file: ProjectFile) => {
    setFileId(file.id);
  };

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!fileId || !path) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }
    editor.tf.setNodes(
      { fileId, caption: caption.trim() },
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
      title="Diagram embed"
      width={480}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !fileId, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Diagram">
          <DiagramPicker fileTree={fileTree} selectedId={fileId} onSelect={handleSelectFile} />
        </DialogSection>
        <DialogSection label="Caption (optional)">
          <input
            className={styles.input}
            type="text"
            placeholder="Add a caption…"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
