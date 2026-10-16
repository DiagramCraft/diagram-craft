import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { type AssessmentWidgetMode } from './assessmentsWidgetLogic';
import { Select } from '@diagram-craft/app-components/Select';
import { FormGroup } from '../../../components/FormGroup';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { AssessmentsWidgetConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type AssessmentsConfigFormProps = {
  config: AssessmentsWidgetConfig;
  onChange: (config: AssessmentsWidgetConfig) => void;
};

export const AssessmentsConfigForm = ({ config, onChange }: AssessmentsConfigFormProps) => {
  const { assessmentTypes, schemas } = useWorkspaceContext();
  const selectedSchemas = config.schemaNames ?? [];
  const toggleSchema = (name: string, checked: boolean) => {
    const next = checked
      ? [...selectedSchemas, name]
      : selectedSchemas.filter(existing => existing !== name);
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
      <FormGroup label="Assessment type" supplementaryLabel="(optional)" variant="simple">
        <Select.Root
          value={config.assessmentTypeId ?? ''}
          onChange={value => onChange({ ...config, assessmentTypeId: optionalText(value ?? '') })}
        >
          <Select.Item value="">Any assessment type</Select.Item>
          {assessmentTypes.map(type => (
            <Select.Item key={type.id} value={type.id}>
              {type.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Scoped to entity types" supplementaryLabel="(optional)" variant="simple">
        <FormCheckboxList>
          {schemas.map(schema => (
            <FormCheckboxList.Row key={schema.id} label={schema.name}>
              <input
                type="checkbox"
                checked={selectedSchemas.includes(schema.name)}
                onChange={event => toggleSchema(schema.name, event.currentTarget.checked)}
              />
            </FormCheckboxList.Row>
          ))}
        </FormCheckboxList>
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormCheckboxList>
          <FormCheckboxList.Row label="Day-count due labels and project">
            <input
              type="checkbox"
              checked={config.relativeDue ?? false}
              onChange={event =>
                onChange({ ...config, relativeDue: event.currentTarget.checked || undefined })
              }
            />
          </FormCheckboxList.Row>
        </FormCheckboxList>
      </FormGroup>
    </>
  );
};
