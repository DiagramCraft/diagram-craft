import { SafeMarkdown } from '../../../components/SafeMarkdown';
import typography from '../../markdown/articleTypography.module.css';
import styles from './MarkdownWidget.module.css';
import type { TElement } from 'platejs';
import { TbMarkdown } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';

export type MarkdownWidgetConfig = {
  markdown: string;
};

type Props = {
  config: MarkdownWidgetConfig;
};

export const MarkdownWidget = ({ config }: Props) => {
  if (config.markdown.trim() === '') {
    return <div className={styles.empty}>No markdown content.</div>;
  }

  return (
    <SafeMarkdown
      text={config.markdown}
      classNames={{ root: `${styles.content} ${typography.articleTypography}` }}
    />
  );
};

type MarkdownDashboardConfigFormProps = {
  config: MarkdownWidgetConfig;
  onChange: (config: MarkdownWidgetConfig) => void;
};

export const MarkdownDashboardConfigForm = ({
  config,
  onChange
}: MarkdownDashboardConfigFormProps) => (
  <>
    <DialogSection label="Markdown">
      <textarea
        className={configFormStyles.markdownInput}
        value={config.markdown}
        onChange={e => onChange({ ...config, markdown: e.target.value })}
        placeholder="Write Markdown…"
        rows={12}
      />
    </DialogSection>
  </>
);

export const MARKDOWN_WIDGET_TYPE = 'markdown' as const;

interface MarkdownSlateElement extends TElement {}

/** Dashboard-only widget; editing is handled by the dashboard config dialog. */
export const markdownWidgetSpec = defineMdxComponent<
  MarkdownSlateElement,
  { config: MarkdownWidgetConfig },
  'block'
>({
  component: MarkdownWidget,
  mode: 'block',
  allowedProps: [],
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbMarkdown,
    label: 'Markdown',
    description: 'Display simple Markdown content on the dashboard.',
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: MarkdownWidget,
    isValidConfig: (config): config is MarkdownWidgetConfig => typeof config.markdown === 'string',
    createDefaultConfig: () => ({ markdown: '' }),
    configForm: MarkdownDashboardConfigForm
  }
});
