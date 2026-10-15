import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { RELATION_TABLE_META_COLUMNS } from './relationTableLogic';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { RelationTableWidgetConfig } from './types';

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
      <DialogSection label="Relation type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.relationSchemaName}
          onChange={event =>
            onChange({ ...config, relationSchemaName: event.currentTarget.value, fieldIds: [] })
          }
        >
          <option value="">Select a relation type…</option>
          {relationSchemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Columns" required={false}>
        <div className={configFormStyles.options}>
          {options.map(option => (
            <label key={option.id} className={configFormStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={isSelected(option.id, option.label)}
                onChange={() => toggle(option.id, option.label)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Filter" required={false}>
        <input
          type="text"
          className={configFormStyles.labelInput}
          value={config.filter ?? ''}
          placeholder='e.g. data_classification in ("sensitive", "highly-sensitive")'
          onChange={event => {
            const value = event.currentTarget.value;
            onChange({ ...config, filter: value.trim() === '' ? undefined : value });
          }}
        />
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.checkboxRow}>
            <input
              type="checkbox"
              checked={config.rowDrawer === true}
              onChange={event =>
                onChange({ ...config, rowDrawer: event.currentTarget.checked || undefined })
              }
            />
            <span>Open a detail drawer when a row is clicked</span>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Max rows</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                min={1}
                max={500}
                className={configFormStyles.labelInput}
                value={config.limit}
                onChange={event =>
                  onChange({
                    ...config,
                    limit: Math.max(1, Number(event.currentTarget.value) || 1)
                  })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
