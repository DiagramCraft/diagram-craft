import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import type { ActivityFeedWidgetConfig } from './types';

type ActivityFeedConfigFormProps = {
  config: ActivityFeedWidgetConfig;
  onChange: (config: ActivityFeedWidgetConfig) => void;
};

export const ActivityFeedDashboardConfigForm = ({
  config,
  onChange
}: ActivityFeedConfigFormProps) => (
  <FormGroup label="Activity Feed" supplementaryLabel="(optional)" variant="simple">
    <FormGrid>
      <FormGrid.Row label="Item limit">
        <NumberInput
          value={config.limit ?? ''}
          min={1}
          max={50}
          step={1}
          onChange={value => onChange({ ...config, limit: value })}
          style={{ width: '80px' }}
        />
      </FormGrid.Row>
    </FormGrid>
  </FormGroup>
);
