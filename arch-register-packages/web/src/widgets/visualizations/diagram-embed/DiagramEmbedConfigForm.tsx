import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import type { ConfigFormProps } from '../../shared/types';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { useMarkdownDiagramSession } from '../../../sections/markdown/MarkdownDiagramSessionContext';
import { DiagramPicker } from '../../../components/DiagramPicker';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { useContentTree, type ContentScope } from '../../../hooks/useContentScope';
import { useCreateMarkdownDiagramAttachment } from '../../../hooks/useAttachments';
import { emptyDiagram } from '../../../lib/diagramDocuments';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import type { DiagramEmbedWidgetConfig } from './types';
import styles from './DiagramEmbedConfigForm.module.css';
import dialogStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';

type EmbedMode = 'new' | 'existing';

const EMBED_MODES: { value: EmbedMode; label: string }[] = [
  { value: 'new', label: 'Create new' },
  { value: 'existing', label: 'Embed existing' }
];

export const DiagramEmbedConfigForm = ({
  config,
  onChange,
  context,
  registerSaveHook
}: ConfigFormProps<DiagramEmbedWidgetConfig>) => {
  const params = useParams({ strict: false });
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId: contextProjectId } = useMdxContext();
  const { trackCreatedDiagram } = useMarkdownDiagramSession();
  const projectId = contextProjectId ?? params.projectId;
  const entityId = context.mode === 'mdx' ? params.entityId : undefined;
  const nodeId = context.mode === 'mdx' ? params.nodeId : undefined;
  const scope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };
  const { data: fileTree } = useContentTree(scope);

  // Creating a new diagram is only possible while editing a document that can own the attachment.
  const canCreate = !!registerSaveHook && !!nodeId;
  const [mode, setMode] = useState<EmbedMode>(canCreate && !config.fileId ? 'new' : 'existing');
  const [diagramName, setDiagramName] = useState('Diagram');
  const createDiagramAttachment = useCreateMarkdownDiagramAttachment(scope, nodeId ?? '');
  const { mutateAsync: createDiagram } = createDiagramAttachment;

  const isCreating = canCreate && mode === 'new';

  useEffect(() => {
    if (!registerSaveHook) return;
    if (!isCreating) {
      registerSaveHook(null);
      return;
    }
    registerSaveHook({
      ready: true,
      prepare: async current => {
        const name = diagramName.trim() === '' ? 'Diagram' : diagramName.trim();
        const file = await createDiagram({ name, content: emptyDiagram(name) });
        trackCreatedDiagram({ id: file.id, path: file.path, name: file.name });
        return { ...current, fileId: file.id };
      }
    });
    return () => registerSaveHook(null);
  }, [registerSaveHook, isCreating, diagramName, createDiagram, trackCreatedDiagram]);

  return (
    <>
      {canCreate && (
        <div className={styles.modeSwitcher}>
          <ModeSwitcher modes={EMBED_MODES} value={mode} onChange={setMode} />
        </div>
      )}
      {isCreating && (
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
      {!isCreating && (
        <DialogSection label="Diagram">
          <DiagramPicker
            fileTree={fileTree}
            selectedId={config.fileId}
            onSelect={(file: ProjectFile) => onChange({ ...config, fileId: file.id })}
          />
        </DialogSection>
      )}
      <DialogSection label="Caption" required={false}>
        <input
          type="text"
          className={dialogStyles.labelInput}
          value={config.caption ?? ''}
          onChange={e =>
            onChange({
              ...config,
              caption: e.target.value.trim() === '' ? undefined : e.target.value
            })
          }
          placeholder="Add a caption…"
        />
      </DialogSection>
    </>
  );
};
