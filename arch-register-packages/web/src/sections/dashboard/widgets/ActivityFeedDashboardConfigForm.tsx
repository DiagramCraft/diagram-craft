import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { ActivityFeedWidgetConfig } from './ActivityFeedWidget';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  config: ActivityFeedWidgetConfig;
  onChange: (config: ActivityFeedWidgetConfig) => void;
};

export const ActivityFeedDashboardConfigForm = ({ config, onChange }: Props) => (
  <DialogSection label="Options" required={false}>
    <div className={styles.options}>
      <label className={styles.optionRow}>
        <span className={styles.optionLabel}>Item limit</span>
        <div className={styles.optionControl}>
          <NumberInput
            value={config.limit ?? ''}
            min={1}
            max={50}
            step={1}
            onChange={value => onChange({ ...config, limit: value })}
            style={{ width: '80px' }}
          />
        </div>
      </label>
    </div>
  </DialogSection>
);
