import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import type { RiskMatrixAxis, RiskMatrixWidgetConfig } from './RiskMatrixWidget';

type Props = {
  config: RiskMatrixWidgetConfig;
  onChange: (config: RiskMatrixWidgetConfig) => void;
};

export const RiskMatrixConfigForm = ({ config, onChange }: Props) => {
  const { schemas } = useWorkspaceContext();
  return (
    <>
      <FormGroup label="Risk entity type" variant="simple">
        <Select.Root
          value={config.schemaName}
          onChange={value => onChange({ ...config, schemaName: value ?? '' })}
        >
          <Select.Item value="">Select an entity type…</Select.Item>
          {schemas.map(schema => (
            <Select.Item key={schema.id} value={schema.name}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Initial axis" supplementaryLabel="(optional)" variant="simple">
        <Select.Root
          value={config.axis ?? 'inherent'}
          onChange={value => onChange({ ...config, axis: (value ?? 'inherent') as RiskMatrixAxis })}
        >
          <Select.Item value="inherent">Inherent</Select.Item>
          <Select.Item value="residual">Residual</Select.Item>
        </Select.Root>
      </FormGroup>
      <FormGroup label="Closed risks" supplementaryLabel="(optional)" variant="simple">
        <FormCheckboxList>
          <FormCheckboxList.Row label="Include closed risks">
            <input
              type="checkbox"
              checked={config.includeClosed ?? false}
              onChange={event =>
                onChange({ ...config, includeClosed: event.currentTarget.checked || undefined })
              }
            />
          </FormCheckboxList.Row>
        </FormCheckboxList>
      </FormGroup>
    </>
  );
};
