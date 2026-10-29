import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { CountByFieldWidgetConfig } from './types';

type CountByFieldConfigFormProps = {
  config: CountByFieldWidgetConfig;
  onChange: (config: CountByFieldWidgetConfig) => void;
};

export const CountByFieldConfigForm = ({ config, onChange }: CountByFieldConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  return (
    <>
      <FormGroup label="Entity type" variant="simple">
        <Select.Root
          value={config.schemaName}
          onChange={value => onChange({ ...config, schemaName: value ?? '', fieldId: '' })}
        >
          <Select.Item value="">Select an entity type…</Select.Item>
          {schemas.map(candidate => (
            <Select.Item key={candidate.id} value={candidate.name}>
              {candidate.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Count by field" variant="simple">
        <Select.Root
          value={config.fieldId}
          onChange={value => onChange({ ...config, fieldId: value ?? '' })}
        >
          <Select.Item value="">Select a field…</Select.Item>
          {(schema?.fields ?? []).map(field => (
            <Select.Item key={field.id} value={field.id}>
              {field.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
    </>
  );
};
