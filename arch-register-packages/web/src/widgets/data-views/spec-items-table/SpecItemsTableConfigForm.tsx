import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { SpecItemsTableWidgetConfig } from './types';

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
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.checkboxRow}>
            <input
              type="checkbox"
              checked={config.deprecated === true}
              onChange={event =>
                onChange({ ...config, deprecated: event.currentTarget.checked || undefined })
              }
            />
            <span>Only deprecated operations</span>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
