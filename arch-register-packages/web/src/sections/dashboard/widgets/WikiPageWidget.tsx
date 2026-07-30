import { TbBook } from 'react-icons/tb';
import { LoadingState } from '../../../components/LoadingState';
import { useContentFile } from '../../../hooks/useContentScope';
import { useMarkdownContent } from '../../../hooks/useMarkdownContent';
import { useMdxContext } from '../../markdown/MdxContext';
import { MdxPreview } from '../../markdown/preview/MdxPreview';
import typography from '../../markdown/articleTypography.module.css';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { WikiPagePicker } from './WikiPagePicker';
import styles from './WikiPageWidget.module.css';
import type { WidgetSurface } from '../dashboardWidgetDefaults';
import type { TElement } from 'platejs';

export type WikiPageWidgetConfig = { nodeId: string };

const isWikiPageWidgetConfig = (config: Record<string, unknown>): config is WikiPageWidgetConfig =>
  typeof config.nodeId === 'string' && config.nodeId.length > 0;

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
}: {
  config: WikiPageWidgetConfig;
  onChange: (config: WikiPageWidgetConfig) => void;
  context: { workspaceSlug: string; projectId?: string; surface: WidgetSurface };
}) => (
  <DialogSection label="Wiki page">
    <WikiPagePicker
      workspaceSlug={context.workspaceSlug}
      projectId={context.projectId}
      surface={context.surface}
      value={config.nodeId}
      onChange={nodeId => onChange({ ...config, nodeId })}
    />
  </DialogSection>
);

interface WikiPageSlateElement extends TElement {}

export const wikiPageWidgetSpec = defineMdxComponent<
  WikiPageSlateElement,
  { config: WikiPageWidgetConfig },
  'block'
>({
  component: WikiPageWidget,
  mode: 'block',
  allowedProps: [],
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbBook,
    label: 'Wiki page',
    description: 'Display a selected wiki page on the dashboard.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace', 'project'],
    component: WikiPageWidget,
    titleComponent: WikiPageWidgetTitle,
    isValidConfig: isWikiPageWidgetConfig,
    createDefaultConfig: () => ({ nodeId: '' }),
    getTitle: () => 'Wiki page',
    configForm: WikiPageDashboardConfigForm,
    dialogWidth: 520
  } satisfies DashboardWidgetSpec<WikiPageWidgetConfig>
});
