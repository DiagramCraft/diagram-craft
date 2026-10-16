import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import type { EntityStaleReportProps } from './types';

type Props = {
  config: EntityStaleReportProps;
  onChange: (config: EntityStaleReportProps) => void;
};

export const EntityStaleReportDashboardConfigForm = ({ config, onChange }: Props) => (
  <FormGroup label="Options" supplementaryLabel="(optional)" variant="simple">
    <FormGrid>
      <FormGrid.Row label="Stale after (days)">
        <NumberInput
          value={config.staleAfterDays ?? ''}
          min={1}
          max={365}
          step={1}
          onChange={value => onChange({ ...config, staleAfterDays: value })}
          style={{ width: '80px' }}
        />
      </FormGrid.Row>
    </FormGrid>
  </FormGroup>
);
