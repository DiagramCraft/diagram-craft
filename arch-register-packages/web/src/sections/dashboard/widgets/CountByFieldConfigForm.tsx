import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { CountByFieldWidgetConfig } from './CountByFieldWidget';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  config: CountByFieldWidgetConfig;
  onChange: (config: CountByFieldWidgetConfig) => void;
};

export const CountByFieldConfigForm = ({ config, onChange }: Props) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={styles.labelInput}
          value={config.schemaName}
          onChange={event =>
            onChange({ ...config, schemaName: event.currentTarget.value, fieldId: '' })
          }
        >
          <option value="">Select an entity type…</option>
          {schemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Count by field" required>
        <select
          className={styles.labelInput}
          value={config.fieldId}
          onChange={event => onChange({ ...config, fieldId: event.currentTarget.value })}
        >
          <option value="">Select a field…</option>
          {(schema?.fields ?? []).map(field => (
            <option key={field.id} value={field.id}>
              {field.name}
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
                placeholder="Use the widget name"
                onChange={event => {
                  const value = event.currentTarget.value;
                  onChange({ ...config, label: value.trim() === '' ? undefined : value });
                }}
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
