import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { useParams } from '@tanstack/react-router';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import type { ContentScope } from '../../../../../hooks/useContentScope';
import { useCreateMarkdownDiagramAttachment } from '../../../../../hooks/useAttachments';
import { emptyDiagram } from '../../../../../lib/diagramDocuments';
import { useMarkdownDiagramSession } from '../../../MarkdownDiagramSessionContext';
import { DiagramEmbedConfigForm } from './DiagramEmbedConfigForm';
import type { DiagramEmbedWidgetConfig } from './types';
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
  const [diagramName, setDiagramName] = useState('Diagram');

  const contentScope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };
  const createDiagramAttachment = useCreateMarkdownDiagramAttachment(contentScope, nodeId ?? '');
  const [config, setConfig] = useState<DiagramEmbedWidgetConfig>(() => ({
    fileId: el.fileId ?? '',
    caption: el.caption ?? ''
  }));

  const handleConfirm = async () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    let resolvedFileId = config.fileId;
    if (mode === 'new') {
      const trimmedName = diagramName.trim();
      const name = trimmedName === '' ? 'Diagram' : trimmedName;
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
      { fileId: resolvedFileId, caption: config.caption?.trim() ?? '' },
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
    createDiagramAttachment.isPending || (mode === 'existing' && !config.fileId);

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
        {mode === 'new' && (
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
        )}
        <DiagramEmbedConfigForm
          config={config}
          onChange={setConfig}
          context={{ mode: 'mdx', surface: projectId ? 'project' : 'workspace' }}
          showPicker={mode === 'existing'}
        />
      </DialogContent>
    </Dialog>
  );
};
