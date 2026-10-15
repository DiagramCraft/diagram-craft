import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import formStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { ActivityFeedWidgetConfig } from './types';

type ActivityFeedConfigFormProps = {
  config: ActivityFeedWidgetConfig;
  onChange: (config: ActivityFeedWidgetConfig) => void;
};

export const ActivityFeedDashboardConfigForm = ({
  config,
  onChange
}: ActivityFeedConfigFormProps) => (
  <DialogSection label="Options" required={false}>
    <div className={formStyles.options}>
      <label className={formStyles.optionRow}>
        <span className={formStyles.optionLabel}>Item limit</span>
        <div className={formStyles.optionControl}>
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
