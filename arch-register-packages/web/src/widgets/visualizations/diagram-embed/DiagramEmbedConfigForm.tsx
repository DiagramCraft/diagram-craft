import { useParams } from '@tanstack/react-router';
import type { ConfigFormProps } from '../../shared/types';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { DiagramPicker } from '../../../components/DiagramPicker';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { useContentTree, type ContentScope } from '../../../hooks/useContentScope';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import type { DiagramEmbedWidgetConfig } from './types';
import styles from '../../../sections/dashboard/WidgetConfigDialog.module.css';

type Props = ConfigFormProps<DiagramEmbedWidgetConfig> & { showPicker?: boolean };

export const DiagramEmbedConfigForm = ({ config, onChange, context, showPicker = true }: Props) => {
  const params = useParams({ strict: false });
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId: contextProjectId } = useMdxContext();
  const projectId = contextProjectId ?? params.projectId;
  const entityId = context.mode === 'mdx' ? params.entityId : undefined;
  const scope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };
  const { data: fileTree } = useContentTree(scope);

  return (
    <>
      {showPicker && (
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
          className={styles.labelInput}
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
