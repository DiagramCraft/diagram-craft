import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { ConformanceViolationsWidgetConfig } from './types';

export const ConformanceViolationsConfigForm = ({
  config,
  onChange
}: {
  config: ConformanceViolationsWidgetConfig;
  onChange: (config: ConformanceViolationsWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.schemaName}
          onChange={event => onChange({ ...config, schemaName: event.currentTarget.value })}
        >
          <option value="">Select an entity type…</option>
          {schemas.map(schema => (
            <option key={schema.id} value={schema.name}>
              {schema.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Max rows</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                min={1}
                max={50}
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
