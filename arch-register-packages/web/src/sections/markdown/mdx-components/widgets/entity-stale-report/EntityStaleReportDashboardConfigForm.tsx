import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { DialogSection } from '../../../editor/BlockDialog';
import type { EntityStaleReportProps } from './types';
import styles from '../../../../dashboard/WidgetConfigDialog.module.css';

type Props = {
  config: EntityStaleReportProps;
  onChange: (config: EntityStaleReportProps) => void;
};

export const EntityStaleReportDashboardConfigForm = ({ config, onChange }: Props) => (
  <DialogSection label="Options" required={false}>
    <div className={styles.options}>
      <label className={styles.optionRow}>
        <span className={styles.optionLabel}>Stale after (days)</span>
        <div className={styles.optionControl}>
          <NumberInput
            value={config.staleAfterDays ?? ''}
            min={1}
            max={365}
            step={1}
            onChange={value => onChange({ ...config, staleAfterDays: value })}
            style={{ width: '80px' }}
          />
        </div>
      </label>
    </div>
  </DialogSection>
);
