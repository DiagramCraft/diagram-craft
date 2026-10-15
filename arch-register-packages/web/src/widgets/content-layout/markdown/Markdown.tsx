import { SafeMarkdown } from '../../../components/SafeMarkdown';
import typography from '../../../sections/markdown/articleTypography.module.css';
import styles from './Markdown.module.css';

import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const markdownWidgetConfigSchema = z.object({
  markdown: withInitial(z.string(), '')
});

export type MarkdownWidgetConfig = z.infer<typeof markdownWidgetConfigSchema>;

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
