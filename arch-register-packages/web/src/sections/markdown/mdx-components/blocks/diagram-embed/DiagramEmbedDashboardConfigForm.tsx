import { DiagramPicker } from '../../../../../components/DiagramPicker';
import { DialogSection } from '../../../editor/BlockDialog';
import { useContentTree, type ContentScope } from '../../../../../hooks/useContentScope';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import type { DiagramEmbedWidgetConfig } from './types';
import styles from '../../../../dashboard/WidgetConfigDialog.module.css';

type Props = {
  config: DiagramEmbedWidgetConfig;
  onChange: (config: DiagramEmbedWidgetConfig) => void;
  context: { mode: 'mdx' | 'dashboard'; workspaceSlug: string; projectId?: string };
};

export const DiagramEmbedDashboardConfigForm = ({ config, onChange, context }: Props) => {
  const scope: ContentScope = context.projectId
    ? { kind: 'project', workspaceId: context.workspaceSlug, projectId: context.projectId }
    : { kind: 'workspace', workspaceId: context.workspaceSlug };
  const { data: fileTree } = useContentTree(scope);

  return (
    <>
      <DialogSection label="Diagram">
        <DiagramPicker
          fileTree={fileTree}
          selectedId={config.fileId}
          onSelect={(file: ProjectFile) => onChange({ ...config, fileId: file.id })}
        />
      </DialogSection>
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
