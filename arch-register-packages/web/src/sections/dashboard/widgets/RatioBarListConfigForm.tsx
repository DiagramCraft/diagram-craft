import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { RatioBarListWidgetConfig } from './RatioBarListWidget';
import styles from '../WidgetConfigDialog.module.css';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: RatioBarListWidgetConfig;
  onChange: (config: RatioBarListWidgetConfig) => void;
};

export const RatioBarListConfigForm = ({ config, onChange }: Props) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  const textOption = (
    label: string,
    value: string,
    onValue: (value: string) => void,
    placeholder?: string
  ) => (
    <label className={styles.optionRow}>
      <span className={styles.optionLabel}>{label}</span>
      <div className={styles.optionControl}>
        <input
          type="text"
          className={styles.labelInput}
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
          className={styles.labelInput}
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
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Group by</span>
            <div className={styles.optionControl}>
              <select
                className={styles.labelInput}
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
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Filled when field</span>
            <div className={styles.optionControl}>
              <select
                className={styles.labelInput}
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
                onChange={event =>
                  onChange({ ...config, label: optionalText(event.currentTarget.value) })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
