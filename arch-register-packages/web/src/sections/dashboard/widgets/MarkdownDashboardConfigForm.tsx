import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { MarkdownWidgetConfig } from './MarkdownWidget';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  config: MarkdownWidgetConfig;
  onChange: (config: MarkdownWidgetConfig) => void;
};

export const MarkdownDashboardConfigForm = ({ config, onChange }: Props) => (
  <>
    <DialogSection label="Title">
      <input
        type="text"
        className={styles.labelInput}
        value={config.title}
        onChange={e => onChange({ ...config, title: e.target.value })}
        placeholder="Markdown"
      />
    </DialogSection>
    <DialogSection label="Markdown">
      <textarea
        className={styles.markdownInput}
        value={config.markdown}
        onChange={e => onChange({ ...config, markdown: e.target.value })}
        placeholder="Write Markdown…"
        rows={12}
      />
    </DialogSection>
  </>
);
