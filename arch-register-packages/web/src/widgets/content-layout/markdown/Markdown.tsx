import { SafeMarkdown } from '../../../components/SafeMarkdown';
import typography from '../../../sections/markdown/articleTypography.module.css';
import styles from './Markdown.module.css';
import { MarkdownWidgetConfig } from './types';

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
