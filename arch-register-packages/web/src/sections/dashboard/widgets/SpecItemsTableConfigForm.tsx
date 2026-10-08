import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { SpecItemsTableWidgetConfig } from './SpecItemsTableWidget';
import styles from '../WidgetConfigDialog.module.css';

export const SpecItemsTableConfigForm = ({
  config,
  onChange
}: {
  config: SpecItemsTableWidgetConfig;
  onChange: (config: SpecItemsTableWidgetConfig) => void;
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
          {schemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={config.deprecated === true}
              onChange={event =>
                onChange({ ...config, deprecated: event.currentTarget.checked || undefined })
              }
            />
            <span>Only deprecated operations</span>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Title</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.label ?? ''}
                placeholder="Operations"
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
