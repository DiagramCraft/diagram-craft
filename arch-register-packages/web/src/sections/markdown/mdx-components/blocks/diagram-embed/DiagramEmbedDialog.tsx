import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { useParams } from '@tanstack/react-router';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntityContentNodes } from '../../../../../hooks/useProjects';
import {
  useProjectFiles,
  useWorkspaceContentNodes,
  useCreateMarkdownDiagramAttachment
} from '../../../../../hooks/useProjectFiles';
import { emptyDiagram } from '../../../../../lib/diagramDocuments';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import { DiagramPicker } from '../../../../../components/DiagramPicker';
import { useMarkdownDiagramSession } from '../../../MarkdownDiagramSessionContext';
import type { DiagramEmbedSlateElement } from './types';
import styles from './DiagramEmbedDialog.module.css';

type EmbedMode = 'new' | 'existing';

const EMBED_MODES: { value: EmbedMode; label: string }[] = [
  { value: 'new', label: 'Create new' },
  { value: 'existing', label: 'Embed existing' }
];

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
  const { trackCreatedDiagram } = useMarkdownDiagramSession();
  const params = useParams({ strict: false });
  const { projectId, entityId, nodeId } = params;

  const el = element as DiagramEmbedSlateElement;
  const hasExisting = !!el.fileId;
  const [mode, setMode] = useState<EmbedMode>(nodeId && !hasExisting ? 'new' : 'existing');
  const [fileId, setFileId] = useState(el.fileId ?? '');
  const [diagramName, setDiagramName] = useState('Diagram');
  const [caption, setCaption] = useState(el.caption ?? '');

  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', {
    enabled: !!entityId
  });
  // useProjectFiles is naturally disabled when projectId is '' (its own enabled guard)
  const { data: projectFiles } = useProjectFiles(workspaceSlug, projectId ?? '');
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, {
    enabled: !projectId && !entityId
  });
  const createDiagramAttachment = useCreateMarkdownDiagramAttachment(
    workspaceSlug,
    nodeId ?? '',
    { projectId, entityId }
  );

  const fileTree: FileTree | undefined = entityId
    ? entityFiles
    : projectId
      ? projectFiles
      : workspaceFiles;

  const handleSelectFile = (file: ProjectFile) => {
    setFileId(file.id);
  };

  const handleConfirm = async () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    let resolvedFileId = fileId;
    if (mode === 'new') {
      const name = diagramName.trim() || 'Diagram';
      const file = await createDiagramAttachment.mutateAsync({
        name,
        content: emptyDiagram(name)
      });
      trackCreatedDiagram({ id: file.id, path: file.path, name: file.name });
      resolvedFileId = file.id;
    }

    if (!resolvedFileId) {
      if (isNew) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }

    editor.tf.setNodes(
      { fileId: resolvedFileId, caption: caption.trim() },
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

  const isSaveDisabled =
    createDiagramAttachment.isPending ||
    (mode === 'existing' && !fileId);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Diagram embed"
      width={480}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: isSaveDisabled, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        {nodeId && (
          <div className={styles.modeSwitcher}>
            <ModeSwitcher modes={EMBED_MODES} value={mode} onChange={setMode} />
          </div>
        )}
        {mode === 'new' ? (
          <DialogSection label="Name">
            <input
              className={styles.input}
              type="text"
              placeholder="Diagram name…"
              value={diagramName}
              onChange={e => setDiagramName(e.target.value)}
              autoFocus
            />
          </DialogSection>
        ) : (
          <DialogSection label="Diagram">
            <DiagramPicker fileTree={fileTree} selectedId={fileId} onSelect={handleSelectFile} />
          </DialogSection>
        )}
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
