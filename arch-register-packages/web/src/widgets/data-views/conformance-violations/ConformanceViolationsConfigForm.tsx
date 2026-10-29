import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { ConformanceViolationsWidgetConfig } from './types';

export const ConformanceViolationsConfigForm = ({
  config,
  onChange
}: {
  config: ConformanceViolationsWidgetConfig;
  onChange: (config: ConformanceViolationsWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  return (
    <>
      <FormGroup label="Entity type" variant="simple">
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
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Max rows">
            <NumberInput
              min={1}
              max={50}
              value={config.limit}
              style={{ width: '80px' }}
              onChange={value => onChange({ ...config, limit: Math.max(1, value ?? 1) })}
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
