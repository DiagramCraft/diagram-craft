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
          value={config.axis ?? 'residual'}
          onChange={event =>
            onChange({ ...config, axis: event.currentTarget.value as RiskMatrixAxis })
          }
        >
          <option value="residual">Residual</option>
          <option value="inherent">Inherent</option>
        </select>
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
