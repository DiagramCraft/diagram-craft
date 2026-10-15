import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { RatioBarListWidgetConfig } from './types';

type RatioBarListConfigFormProps = {
  config: RatioBarListWidgetConfig;
  onChange: (config: RatioBarListWidgetConfig) => void;
};

export const RatioBarListConfigForm = ({ config, onChange }: RatioBarListConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  const textOption = (
    label: string,
    value: string,
    onValue: (value: string) => void,
    placeholder?: string
  ) => (
    <label className={configFormStyles.optionRow}>
      <span className={configFormStyles.optionLabel}>{label}</span>
      <div className={configFormStyles.optionControl}>
        <input
          type="text"
          className={configFormStyles.labelInput}
          value={value}
          placeholder={placeholder}
          onChange={event => onValue(event.currentTarget.value)}
        />
      </div>
    </label>
  );

  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.schemaName}
          onChange={event => onChange({ ...config, schemaName: event.currentTarget.value })}
        >
          <option value="">Select an entity type…</option>
          {schemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Bars" required>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Group by</span>
            <div className={configFormStyles.optionControl}>
              <select
                className={configFormStyles.labelInput}
                value={config.groupByFieldId}
                onChange={event =>
                  onChange({ ...config, groupByFieldId: event.currentTarget.value })
                }
              >
                <option value="">Select a field…</option>
                {(schema?.fields ?? []).map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Filled when field</span>
            <div className={configFormStyles.optionControl}>
              <select
                className={configFormStyles.labelInput}
                value={config.numeratorFieldId}
                onChange={event =>
                  onChange({ ...config, numeratorFieldId: event.currentTarget.value })
                }
              >
                <option value="">Select a field…</option>
                {(schema?.fields ?? []).map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
          {textOption(
            'Equals value',
            config.numeratorValue,
            value => onChange({ ...config, numeratorValue: value }),
            'e.g. effective'
          )}
        </div>
      </DialogSection>
    </>
  );
};
