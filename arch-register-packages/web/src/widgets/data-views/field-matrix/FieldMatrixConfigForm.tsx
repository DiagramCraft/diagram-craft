import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { FieldMatrixWidgetConfig } from './types';

type FieldMatrixConfigFormProps = {
  config: FieldMatrixWidgetConfig;
  onChange: (config: FieldMatrixWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const parseRows = (text: string): number[] =>
  text
    .split(',')
    .filter(part => part.trim() !== '')
    .map(part => Number(part.trim()))
    .filter(value => Number.isFinite(value));

export const FieldMatrixConfigForm = ({ config, onChange }: FieldMatrixConfigFormProps) => (
  <>
    <DialogSection label="Records (query)" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.query ?? ''}
        placeholder='e.g. schema:"Vendor"'
        onChange={e => onChange({ ...config, query: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Row field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.rowFieldId}
        placeholder="e.g. criticality"
        onChange={e => onChange({ ...config, rowFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Row values, top to bottom" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        defaultValue={config.rows.join(', ')}
        placeholder="e.g. 5, 4, 3, 2"
        onBlur={e => onChange({ ...config, rows: parseRows(e.target.value) })}
      />
    </DialogSection>
    <DialogSection label="Column field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.valueFieldId}
        placeholder="e.g. risk"
        onChange={e => onChange({ ...config, valueFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={configFormStyles.options}>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Corner label</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.cornerLabel ?? ''}
              onChange={e => onChange({ ...config, cornerLabel: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Emphasise hot bands from row</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              className={configFormStyles.labelInput}
              value={config.hotRowMin ?? ''}
              onChange={e =>
                onChange({
                  ...config,
                  hotRowMin: e.target.value === '' ? undefined : Number(e.target.value)
                })
              }
            />
          </div>
        </label>
      </div>
    </DialogSection>
    <DialogSection label="Bands (JSON: label, min, tone, hot)" required>
      <textarea
        className={configFormStyles.labelInput}
        rows={6}
        defaultValue={JSON.stringify(config.bands, null, 2)}
        onBlur={e => {
          try {
            const parsed = JSON.parse(e.target.value);
            if (Array.isArray(parsed)) onChange({ ...config, bands: parsed });
          } catch {
            // Keep the previous bands until the text is valid JSON.
          }
        }}
      />
    </DialogSection>
  </>
);
