import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import type { EntityActivityTrendChartProps } from './types';

type Props = {
  config: EntityActivityTrendChartProps;
  onChange: (config: EntityActivityTrendChartProps) => void;
};

export const EntityActivityTrendChartDashboardConfigForm = ({ config, onChange }: Props) => (
  <FormGroup label="Options" supplementaryLabel="(optional)" variant="simple">
    <FormGrid>
      <FormGrid.Row label="Lookback (days)">
        <NumberInput
          value={config.lookbackDays ?? ''}
          min={1}
          max={365}
          step={1}
          onChange={value => onChange({ ...config, lookbackDays: value })}
          style={{ width: '80px' }}
        />
      </FormGrid.Row>
    </FormGrid>
  </FormGroup>
);
