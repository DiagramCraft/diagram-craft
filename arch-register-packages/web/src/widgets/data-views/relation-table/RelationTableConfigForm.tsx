import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { RELATION_TABLE_META_COLUMNS } from './relationTableLogic';
import { RelationTableWidgetConfig } from './types';
import { FormGroup } from '../../../components/FormGroup';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { FormGrid } from '../../../components/FormGrid';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';

export const RelationTableConfigForm = ({
  config,
  onChange
}: {
  config: RelationTableWidgetConfig;
  onChange: (config: RelationTableWidgetConfig) => void;
}) => {
  const { relationSchemas } = useWorkspaceContext();
  const schema = relationSchemas.find(candidate => candidate.name === config.relationSchemaName);
  const options = [
    ...(schema?.fields.map(field => ({ id: field.id, label: field.name })) ?? []),
    ...Object.entries(RELATION_TABLE_META_COLUMNS).map(([id, label]) => ({ id, label }))
  ];
  const isSelected = (id: string, label: string) =>
    config.fieldIds.includes(id) || config.fieldIds.includes(label);
  const toggle = (id: string, label: string) =>
    onChange({
      ...config,
      fieldIds: isSelected(id, label)
        ? config.fieldIds.filter(candidate => candidate !== id && candidate !== label)
        : [...config.fieldIds, id]
    });

  return (
    <>
      <FormGroup label="Relation type" variant={'simple'}>
        <Select.Root
          value={config.relationSchemaName}
          onChange={value => onChange({ ...config, relationSchemaName: value ?? '', fieldIds: [] })}
        >
          <Select.Item value="">Select a relation type…</Select.Item>
          {relationSchemas.map(candidate => (
            <Select.Item key={candidate.id} value={candidate.name}>
              {candidate.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Columns" supplementaryLabel={'(optional)'} variant={'simple'}>
        <FormCheckboxList>
          {options.map(option => (
            <FormCheckboxList.Row key={option.id} label={option.label}>
              <input
                type="checkbox"
                checked={isSelected(option.id, option.label)}
                onChange={() => toggle(option.id, option.label)}
              />
            </FormCheckboxList.Row>
          ))}
        </FormCheckboxList>
      </FormGroup>
      <FormGroup label="Filter" supplementaryLabel={'(optional)'} variant={'simple'}>
        <TextInput
          value={config.filter ?? ''}
          placeholder='e.g. data_classification in ("sensitive", "highly-sensitive")'
          style={{ width: '100%' }}
          onChange={value =>
            onChange({ ...config, filter: value?.trim() === '' ? undefined : value })
          }
        />
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel={'(optional)'} variant={'simple'}>
        <FormCheckboxList>
          <FormCheckboxList.Row label={'Open a detail drawer when a row is clicked'}>
            <input
              type="checkbox"
              checked={config.rowDrawer === true}
              onChange={event =>
                onChange({ ...config, rowDrawer: event.currentTarget.checked || undefined })
              }
            />
          </FormCheckboxList.Row>
          <FormGrid>
            <FormGrid.Row label={'Max rows'}>
              <NumberInput
                value={config.limit}
                min={1}
                max={500}
                step={1}
                onChange={value =>
                  onChange({
                    ...config,
                    limit: Math.max(1, value ?? 1)
                  })
                }
                style={{ width: '80px' }}
              />
            </FormGrid.Row>
          </FormGrid>
        </FormCheckboxList>
      </FormGroup>
    </>
  );
};
