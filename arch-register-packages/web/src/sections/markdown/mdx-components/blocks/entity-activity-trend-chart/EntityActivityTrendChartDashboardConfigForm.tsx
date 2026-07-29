import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { DialogSection } from '../../../editor/BlockDialog';
import type { EntityActivityTrendChartProps } from './types';
import styles from '../../../../dashboard/WidgetConfigDialog.module.css';

type Props = {
  config: EntityActivityTrendChartProps;
  onChange: (config: EntityActivityTrendChartProps) => void;
};

export const EntityActivityTrendChartDashboardConfigForm = ({ config, onChange }: Props) => (
  <DialogSection label="Options" required={false}>
    <div className={styles.options}>
      <label className={styles.optionRow}>
        <span className={styles.optionLabel}>Lookback (days)</span>
        <div className={styles.optionControl}>
          <NumberInput
            value={config.lookbackDays ?? ''}
            min={1}
            max={365}
            step={1}
            onChange={value => onChange({ ...config, lookbackDays: value })}
            style={{ width: '80px' }}
          />
        </div>
      </label>
    </div>
  </DialogSection>
);
