import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { RatioBarListWidgetConfig } from './types';

type RatioBarListConfigFormProps = {
  config: RatioBarListWidgetConfig;
  onChange: (config: RatioBarListWidgetConfig) => void;
};

export const RatioBarListConfigForm = ({ config, onChange }: RatioBarListConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  const fieldSelect = (value: string, onValue: (value: string) => void) => (
    <Select.Root value={value} onChange={v => onValue(v ?? '')} style={{ width: '100%' }}>
      <Select.Item value="">Select a field…</Select.Item>
      {(schema?.fields ?? []).map(field => (
        <Select.Item key={field.id} value={field.id}>
          {field.name}
        </Select.Item>
      ))}
    </Select.Root>
  );

  return (
    <>
      <FormGroup label="Entity type" variant="simple">
        <Select.Root
          value={config.schemaName}
          onChange={value => onChange({ ...config, schemaName: value ?? '' })}
        >
          <Select.Item value="">Select an entity type…</Select.Item>
          {schemas.map(candidate => (
            <Select.Item key={candidate.id} value={candidate.name}>
              {candidate.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Bars" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Group by">
            {fieldSelect(config.groupByFieldId, value =>
              onChange({ ...config, groupByFieldId: value })
            )}
          </FormGrid.Row>
          <FormGrid.Row label="Filled when field">
            {fieldSelect(config.numeratorFieldId, value =>
              onChange({ ...config, numeratorFieldId: value })
            )}
          </FormGrid.Row>
          <FormGrid.Row label="Equals value">
            <TextInput
              value={config.numeratorValue}
              placeholder="e.g. effective"
              style={{ width: '100%' }}
              onChange={value => onChange({ ...config, numeratorValue: value ?? '' })}
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
