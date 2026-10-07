import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { FieldMatrixWidgetConfig } from './FieldMatrixWidget';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
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

export const FieldMatrixConfigForm = ({ config, onChange }: Props) => (
  <>
    <DialogSection label="Records (query)" required>
      <input
        type="text"
        className={styles.labelInput}
        value={config.query ?? ''}
        placeholder='e.g. schema:"Vendor"'
        onChange={e => onChange({ ...config, query: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Row field id" required>
      <input
        type="text"
        className={styles.labelInput}
        value={config.rowFieldId}
        placeholder="e.g. criticality"
        onChange={e => onChange({ ...config, rowFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Row values, top to bottom" required>
      <input
        type="text"
        className={styles.labelInput}
        defaultValue={config.rows.join(', ')}
        placeholder="e.g. 5, 4, 3, 2"
        onBlur={e => onChange({ ...config, rows: parseRows(e.target.value) })}
      />
    </DialogSection>
    <DialogSection label="Column field id" required>
      <input
        type="text"
        className={styles.labelInput}
        value={config.valueFieldId}
        placeholder="e.g. risk"
        onChange={e => onChange({ ...config, valueFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={styles.options}>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Corner label</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.cornerLabel ?? ''}
              onChange={e => onChange({ ...config, cornerLabel: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Emphasise hot bands from row</span>
          <div className={styles.optionControl}>
            <input
              type="number"
              className={styles.labelInput}
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
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Title</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.label ?? ''}
              placeholder="Use the widget name"
              onChange={e => onChange({ ...config, label: optionalText(e.target.value) })}
            />
          </div>
        </label>
      </div>
    </DialogSection>
    <DialogSection label="Bands (JSON: label, min, tone, hot)" required>
      <textarea
        className={styles.labelInput}
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
