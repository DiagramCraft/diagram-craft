import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import type { RiskMatrixAxis, RiskMatrixWidgetConfig } from './RiskMatrixWidget';
import styles from '../../../sections/dashboard/WidgetConfigDialog.module.css';

type Props = {
  config: RiskMatrixWidgetConfig;
  onChange: (config: RiskMatrixWidgetConfig) => void;
};

export const RiskMatrixConfigForm = ({ config, onChange }: Props) => {
  const { schemas } = useWorkspaceContext();
  return (
    <>
      <DialogSection label="Risk entity type" required>
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
      <DialogSection label="Initial axis" required={false}>
        <select
          className={styles.labelInput}
          value={config.axis ?? 'inherent'}
          onChange={event =>
            onChange({ ...config, axis: event.currentTarget.value as RiskMatrixAxis })
          }
        >
          <option value="inherent">Inherent</option>
          <option value="residual">Residual</option>
        </select>
      </DialogSection>
      <DialogSection label="Closed risks" required={false}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={config.includeClosed ?? false}
            onChange={event =>
              onChange({ ...config, includeClosed: event.currentTarget.checked || undefined })
            }
          />
          <span className={styles.optionLabel}>Include closed risks</span>
        </label>
      </DialogSection>
      <DialogSection label="Title" required={false}>
        <input
          type="text"
          className={styles.labelInput}
          value={config.label ?? ''}
          placeholder="Risk matrix"
          onChange={event => onChange({ ...config, label: event.currentTarget.value || undefined })}
        />
      </DialogSection>
    </>
  );
};
