import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { RelatedEntitiesListWidgetConfig } from './types';

type RelatedEntitiesListConfigFormProps = {
  config: RelatedEntitiesListWidgetConfig;
  onChange: (config: RelatedEntitiesListWidgetConfig) => void;
};

const clean = (value: string | undefined): string | undefined =>
  value === '' ? undefined : value;

export const RelatedEntitiesListConfigForm = ({
  config,
  onChange
}: RelatedEntitiesListConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);
  const referenceFields = (schema?.fields ?? []).filter(field => field.type === 'reference');
  const viaSchema = schemas.find(candidate => candidate.name === config.viaSchemaName);
  const viaReferenceFields = (viaSchema?.fields ?? []).filter(field => field.type === 'reference');
  const fields = schema?.fields ?? [];

  const fieldSelect = (
    value: string | undefined,
    set: (value: string | undefined) => void,
    options: ReadonlyArray<{ id: string; name: string }>,
    placeholder: string
  ) => (
    <Select.Root value={value ?? ''} onChange={v => set(clean(v))}>
      <Select.Item value="">{placeholder}</Select.Item>
      {options.map(field => (
        <Select.Item key={field.id} value={field.id}>
          {field.name}
        </Select.Item>
      ))}
    </Select.Root>
  );

  const schemaSelect = (
    value: string | undefined,
    set: (value: string | undefined) => void,
    placeholder: string
  ) => (
    <Select.Root value={value ?? ''} onChange={v => set(clean(v))}>
      <Select.Item value="">{placeholder}</Select.Item>
      {schemas.map(candidate => (
        <Select.Item key={candidate.id} value={candidate.name}>
          {candidate.name}
        </Select.Item>
      ))}
    </Select.Root>
  );

  return (
    <>
      <FormGroup label="Entity to scope by" supplementaryLabel="(optional)" variant="simple">
        <TextInput
          value={config.entityId ?? ''}
          placeholder="Sidebar variable, e.g. $objectiveId"
          style={{ width: '100%' }}
          onChange={value => onChange({ ...config, entityId: clean(value) })}
        />
      </FormGroup>
      <FormGroup label="Listed entity type" variant="simple">
        {schemaSelect(
          config.schemaName,
          value => onChange({ ...config, schemaName: value ?? '', referenceField: '' }),
          'Select an entity type…'
        )}
      </FormGroup>
      <FormGroup label="Reference field" variant="simple">
        {fieldSelect(
          config.referenceField,
          value => onChange({ ...config, referenceField: value ?? '' }),
          referenceFields,
          'Select a reference field…'
        )}
      </FormGroup>
      <FormGroup label="Via entity type" supplementaryLabel="(optional)" variant="simple">
        {schemaSelect(
          config.viaSchemaName,
          value =>
            onChange({
              ...config,
              viaSchemaName: value,
              viaReferenceField: undefined
            }),
          'Reference the entity directly'
        )}
        {config.viaSchemaName &&
          fieldSelect(
            config.viaReferenceField,
            value => onChange({ ...config, viaReferenceField: value }),
            viaReferenceFields,
            'Select the via type’s reference field…'
          )}
      </FormGroup>
      <FormGroup label="Row details" supplementaryLabel="(optional)" variant="simple">
        {fieldSelect(
          config.statusField,
          value => onChange({ ...config, statusField: value }),
          fields,
          'No status field'
        )}
        {fieldSelect(
          config.descriptionField,
          value => onChange({ ...config, descriptionField: value }),
          fields,
          'No description field'
        )}
      </FormGroup>
      <FormGroup label="Progress bar" supplementaryLabel="(optional)" variant="simple">
        {fieldSelect(
          config.progressBaselineField,
          value => onChange({ ...config, progressBaselineField: value }),
          fields,
          'Baseline field'
        )}
        {fieldSelect(
          config.progressCurrentField,
          value => onChange({ ...config, progressCurrentField: value }),
          fields,
          'Current field'
        )}
        {fieldSelect(
          config.progressTargetField,
          value => onChange({ ...config, progressTargetField: value }),
          fields,
          'Target field'
        )}
        {fieldSelect(
          config.progressUnitField,
          value => onChange({ ...config, progressUnitField: value }),
          fields,
          'Unit field'
        )}
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Empty message">
            <TextInput
              value={config.emptyMessage ?? ''}
              style={{ width: '100%' }}
              onChange={value => onChange({ ...config, emptyMessage: clean(value) })}
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
