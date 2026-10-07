import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { DateBucketChartWidgetConfig } from './DateBucketChartWidget';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  config: DateBucketChartWidgetConfig;
  onChange: (config: DateBucketChartWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

export const DateBucketChartConfigForm = ({ config, onChange }: Props) => (
  <>
    <DialogSection label="Records (query)" required>
      <input
        type="text"
        className={styles.labelInput}
        value={config.query}
        placeholder='e.g. schema:"Contract"'
        onChange={e => onChange({ ...config, query: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Date field id" required>
      <input
        type="text"
        className={styles.labelInput}
        value={config.dateFieldId}
        placeholder="e.g. contract_end"
        onChange={e => onChange({ ...config, dateFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={styles.options}>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Sum field id</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.measureFieldId ?? ''}
              placeholder="Blank = count records"
              onChange={e => onChange({ ...config, measureFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Months</span>
          <div className={styles.optionControl}>
            <input
              type="number"
              min={1}
              max={36}
              className={styles.labelInput}
              value={config.bucketCount ?? 12}
              onChange={e => onChange({ ...config, bucketCount: optionalNumber(e.target.value) })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Urgent within (days)</span>
          <div className={styles.optionControl}>
            <input
              type="number"
              min={0}
              className={styles.labelInput}
              value={config.urgentWithinDays ?? ''}
              onChange={e =>
                onChange({ ...config, urgentWithinDays: optionalNumber(e.target.value) })
              }
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Include overdue</span>
          <div className={styles.optionControl}>
            <input
              type="checkbox"
              checked={config.foldOverdue ?? false}
              onChange={e => onChange({ ...config, foldOverdue: e.target.checked || undefined })}
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
  </>
);
