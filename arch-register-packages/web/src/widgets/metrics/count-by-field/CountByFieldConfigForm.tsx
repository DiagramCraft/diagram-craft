import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { CountByFieldWidgetConfig } from './types';

type CountByFieldConfigFormProps = {
  config: CountByFieldWidgetConfig;
  onChange: (config: CountByFieldWidgetConfig) => void;
};

export const CountByFieldConfigForm = ({ config, onChange }: CountByFieldConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={configFormStyles.labelInput}
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
          className={configFormStyles.labelInput}
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
    </>
  );
};
