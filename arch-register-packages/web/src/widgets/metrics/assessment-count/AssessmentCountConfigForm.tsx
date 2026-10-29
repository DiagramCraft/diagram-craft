import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { type AssessmentWidgetMode } from '../../data-views/assessments/assessmentsWidgetLogic';
import { AssessmentCountWidgetConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

export const AssessmentCountConfigForm = ({
  config,
  onChange
}: {
  config: AssessmentCountWidgetConfig;
  onChange: (config: AssessmentCountWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  const selected = config.schemaNames ?? [];
  const toggleSchema = (name: string, checked: boolean) => {
    const next = checked ? [...selected, name] : selected.filter(existing => existing !== name);
    onChange({ ...config, schemaNames: next.length === 0 ? undefined : next });
  };

  return (
    <>
      <FormGroup label="Mode" variant="simple">
        <Select.Root
          value={config.mode}
          onChange={value =>
            onChange({ ...config, mode: (value ?? 'active') as AssessmentWidgetMode })
          }
        >
          <Select.Item value="active">Active</Select.Item>
          <Select.Item value="upcoming">Upcoming</Select.Item>
          <Select.Item value="overdue">Overdue</Select.Item>
          <Select.Item value="all">All</Select.Item>
        </Select.Root>
      </FormGroup>
      <FormGroup label="Scoped to entity types" supplementaryLabel="(optional)" variant="simple">
        <FormCheckboxList>
          {schemas.map(schema => (
            <FormCheckboxList.Row key={schema.id} label={schema.name}>
              <input
                type="checkbox"
                checked={selected.includes(schema.name)}
                onChange={event => toggleSchema(schema.name, event.currentTarget.checked)}
              />
            </FormCheckboxList.Row>
          ))}
        </FormCheckboxList>
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Due within (days)">
            <NumberInput
              min={0}
              value={config.dueWithinDays ?? ''}
              placeholder="Any"
              style={{ width: '80px' }}
              onChange={value => onChange({ ...config, dueWithinDays: value })}
            />
          </FormGrid.Row>
          <FormGrid.Row label="Subtext">
            <TextInput
              value={config.subtext ?? ''}
              style={{ width: '100%' }}
              onChange={value => onChange({ ...config, subtext: optionalText(value ?? '') })}
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
