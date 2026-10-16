import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { SpecItemsTableWidgetConfig } from './types';

export const SpecItemsTableConfigForm = ({
  config,
  onChange
}: {
  config: SpecItemsTableWidgetConfig;
  onChange: (config: SpecItemsTableWidgetConfig) => void;
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
          {schemas.map(candidate => (
            <Select.Item key={candidate.id} value={candidate.name}>
              {candidate.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormCheckboxList>
          <FormCheckboxList.Row label="Only deprecated operations">
            <input
              type="checkbox"
              checked={config.deprecated === true}
              onChange={event =>
                onChange({ ...config, deprecated: event.currentTarget.checked || undefined })
              }
            />
          </FormCheckboxList.Row>
        </FormCheckboxList>
      </FormGroup>
    </>
  );
};
