import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { RelationPairsCoverageWidgetConfig } from './RelationPairsCoverageWidget';
import styles from '../WidgetConfigDialog.module.css';

export const RelationPairsCoverageConfigForm = ({
  config,
  onChange
}: {
  config: RelationPairsCoverageWidgetConfig;
  onChange: (config: RelationPairsCoverageWidgetConfig) => void;
}) => {
  const { schemas, relationSchemas } = useWorkspaceContext();
  const hub = schemas.find(candidate => candidate.name === config.hubSchemaName);
  const relationFields = hub?.fields.filter(field => field.type === 'typedRelation') ?? [];
  const optionalText = (value: string) => (value.trim() === '' ? undefined : value);

  const fieldSelect = (value: string, onValue: (value: string) => void) => (
    <select
      className={styles.labelInput}
      value={value}
      onChange={event => onValue(event.currentTarget.value)}
    >
      <option value="">Select a relation field…</option>
      {relationFields.map(field => (
        <option key={field.id} value={field.name}>
          {field.name}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <DialogSection label="Hub entity type" required>
        <select
          className={styles.labelInput}
          value={config.hubSchemaName}
          onChange={event =>
            onChange({
              ...config,
              hubSchemaName: event.currentTarget.value,
              providerFieldName: '',
              consumerFieldName: ''
            })
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
      <DialogSection label="Providers" required>
        {fieldSelect(config.providerFieldName, value =>
          onChange({ ...config, providerFieldName: value })
        )}
      </DialogSection>
      <DialogSection label="Consumers" required>
        {fieldSelect(config.consumerFieldName, value =>
          onChange({ ...config, consumerFieldName: value })
        )}
      </DialogSection>
      <DialogSection label="Coverage relation type" required>
        <select
          className={styles.labelInput}
          value={config.coverageRelationSchemaName}
          onChange={event =>
            onChange({ ...config, coverageRelationSchemaName: event.currentTarget.value })
          }
        >
          <option value="">Select a relation type…</option>
          {relationSchemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          {(
            [
              ['label', 'Title', 'Pair coverage'],
              ['consumerLabel', 'Consumer heading', 'Consumer'],
              ['hubLabel', 'Hub heading', config.hubSchemaName],
              ['providerLabel', 'Provider heading', 'Provider'],
              ['coverageLabel', 'Coverage heading', config.coverageRelationSchemaName]
            ] as const
          ).map(([key, label, placeholder]) => (
            <label key={key} className={styles.optionRow}>
              <span className={styles.optionLabel}>{label}</span>
              <div className={styles.optionControl}>
                <input
                  type="text"
                  className={styles.labelInput}
                  value={config[key] ?? ''}
                  placeholder={placeholder}
                  onChange={event =>
                    onChange({ ...config, [key]: optionalText(event.currentTarget.value) })
                  }
                />
              </div>
            </label>
          ))}
        </div>
      </DialogSection>
    </>
  );
};
