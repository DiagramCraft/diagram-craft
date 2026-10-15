import { LoadingState } from '../../../components/LoadingState';
import type { ConfigFormProps, WidgetSurface } from '../../shared/types';
import { useContentFile } from '../../../hooks/useContentScope';
import { useMarkdownContent } from '../../../hooks/useMarkdownContent';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { MdxPreview } from '../../../sections/markdown/preview/MdxPreview';
import typography from '../../../sections/markdown/articleTypography.module.css';

import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { WikiPagePicker } from './WikiPagePicker';
import styles from './WikiPage.module.css';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const wikiPageWidgetConfigSchema = z.object({
  nodeId: withInitial(z.string().min(1), '')
});

export type WikiPageWidgetConfig = z.infer<typeof wikiPageWidgetConfigSchema>;

export const isWikiPageWidgetConfig = (
  config: Record<string, unknown>
): config is WikiPageWidgetConfig => typeof config.nodeId === 'string' && config.nodeId.length > 0;

export const isInDashboardScope = (
  projectId: string | undefined,
  surface: WidgetSurface,
  pageProjectId: string | null | undefined
) => (surface === 'project' ? !!projectId && pageProjectId === projectId : pageProjectId === null);

const unavailable = <div className={`${styles.message} dim`}>This wiki page is unavailable.</div>;

export const WikiPageWidget = ({ config }: { config: WikiPageWidgetConfig }) => {
  const { workspaceSlug = '', projectId, dashboardSurface = 'workspace' } = useMdxContext();
  const {
    data: file,
    isLoading: fileLoading,
    isError: fileError
  } = useContentFile(workspaceSlug, config.nodeId);
  const {
    data: content,
    isLoading: contentLoading,
    isError: contentError
  } = useMarkdownContent(workspaceSlug, config.nodeId);

  if (fileLoading || contentLoading) return <LoadingState text="Loading wiki page…" size="sm" />;
  if (
    fileError ||
    contentError ||
    !file ||
    file.type !== 'markdown' ||
    !isInDashboardScope(projectId, dashboardSurface, file.project_id)
  ) {
    return unavailable;
  }
  if (!content?.body.trim())
    return <div className={`${styles.message} dim`}>This wiki page is empty.</div>;

  return (
    <div className={`${styles.content} ${typography.articleTypography}`}>
      <MdxPreview body={content.body} />
    </div>
  );
};

export const WikiPageWidgetTitle = ({ config }: { config: WikiPageWidgetConfig }) => {
  const { workspaceSlug = '', projectId, dashboardSurface = 'workspace' } = useMdxContext();
  const { data: file } = useContentFile(workspaceSlug, config.nodeId);
  return file &&
    file.type === 'markdown' &&
    isInDashboardScope(projectId, dashboardSurface, file.project_id)
    ? file.name
    : 'Wiki page';
};

export const WikiPageDashboardConfigForm = ({
  config,
  onChange,
  context
}: ConfigFormProps<WikiPageWidgetConfig>) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId } = useMdxContext();
  return (
    <DialogSection label="Wiki page">
      <WikiPagePicker
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        surface={context.surface}
        value={config.nodeId}
        onChange={nodeId => onChange({ ...config, nodeId })}
      />
    </DialogSection>
  );
};
