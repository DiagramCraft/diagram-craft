import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { RelationPairsSourceFields } from './RelationPairsSourceFields';
import { RelationPairsCoverageWidgetConfig } from './types';

export const RelationPairsCoverageConfigForm = ({
  config,
  onChange
}: {
  config: RelationPairsCoverageWidgetConfig;
  onChange: (config: RelationPairsCoverageWidgetConfig) => void;
}) => {
  const optionalText = (value: string) => (value.trim() === '' ? undefined : value);

  return (
    <>
      <RelationPairsSourceFields config={config} onChange={onChange} />
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          {(
            [
              ['consumerLabel', 'Consumer heading', 'Consumer'],
              ['hubLabel', 'Hub heading', config.hubSchemaName],
              ['providerLabel', 'Provider heading', 'Provider'],
              ['coverageLabel', 'Coverage heading', config.coverageRelationSchemaName]
            ] as const
          ).map(([key, label, placeholder]) => (
            <label key={key} className={configFormStyles.optionRow}>
              <span className={configFormStyles.optionLabel}>{label}</span>
              <div className={configFormStyles.optionControl}>
                <input
                  type="text"
                  className={configFormStyles.labelInput}
                  value={config[key] ?? ''}
                  placeholder={placeholder}
                  onChange={event =>
                    onChange({
                      ...config,
                      [key]: optionalText(event.currentTarget.value)
                    })
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
