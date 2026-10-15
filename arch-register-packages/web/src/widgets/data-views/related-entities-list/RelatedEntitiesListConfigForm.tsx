import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { RelatedEntitiesListWidgetConfig } from './types';

type RelatedEntitiesListConfigFormProps = {
  config: RelatedEntitiesListWidgetConfig;
  onChange: (config: RelatedEntitiesListWidgetConfig) => void;
};

const clean = (value: string): string | undefined => (value === '' ? undefined : value);

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
    <select
      className={configFormStyles.labelInput}
      value={value ?? ''}
      onChange={event => set(clean(event.currentTarget.value))}
    >
      <option value="">{placeholder}</option>
      {options.map(field => (
        <option key={field.id} value={field.id}>
          {field.name}
        </option>
      ))}
    </select>
  );

  const schemaSelect = (
    value: string | undefined,
    set: (value: string | undefined) => void,
    placeholder: string
  ) => (
    <select
      className={configFormStyles.labelInput}
      value={value ?? ''}
      onChange={event => set(clean(event.currentTarget.value))}
    >
      <option value="">{placeholder}</option>
      {schemas.map(candidate => (
        <option key={candidate.id} value={candidate.name}>
          {candidate.name}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <DialogSection label="Entity to scope by" required={false}>
        <input
          type="text"
          className={configFormStyles.labelInput}
          value={config.entityId ?? ''}
          placeholder="Sidebar variable, e.g. $objectiveId"
          onChange={event => onChange({ ...config, entityId: clean(event.currentTarget.value) })}
        />
      </DialogSection>
      <DialogSection label="Listed entity type" required>
        {schemaSelect(
          config.schemaName,
          value => onChange({ ...config, schemaName: value ?? '', referenceField: '' }),
          'Select an entity type…'
        )}
      </DialogSection>
      <DialogSection label="Reference field" required>
        {fieldSelect(
          config.referenceField,
          value => onChange({ ...config, referenceField: value ?? '' }),
          referenceFields,
          'Select a reference field…'
        )}
      </DialogSection>
      <DialogSection label="Via entity type (optional)" required={false}>
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
      </DialogSection>
      <DialogSection label="Row details" required={false}>
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
      </DialogSection>
      <DialogSection label="Progress bar (optional)" required={false}>
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
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Empty message</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="text"
                className={configFormStyles.labelInput}
                value={config.emptyMessage ?? ''}
                onChange={event =>
                  onChange({ ...config, emptyMessage: clean(event.currentTarget.value) })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
