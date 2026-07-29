import { SafeMarkdown } from '../../../components/SafeMarkdown';
import typography from '../../markdown/articleTypography.module.css';
import styles from './MarkdownWidget.module.css';

export type MarkdownWidgetConfig = {
  title: string;
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
