import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { ConformanceViolationsWidgetConfig } from './ConformanceViolationsWidget';
import styles from '../WidgetConfigDialog.module.css';

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
          className={styles.labelInput}
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
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Title</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.label ?? ''}
                placeholder="Conformance violations"
                onChange={event => {
                  const value = event.currentTarget.value;
                  onChange({ ...config, label: value.trim() === '' ? undefined : value });
                }}
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Max rows</span>
            <div className={styles.optionControl}>
              <input
                type="number"
                min={1}
                max={50}
                className={styles.labelInput}
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
