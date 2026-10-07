import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { UpcomingByDateWidgetConfig } from './UpcomingByDateWidget';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  config: UpcomingByDateWidgetConfig;
  onChange: (config: UpcomingByDateWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

export const UpcomingByDateConfigForm = ({ config, onChange }: Props) => (
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
          <span className={styles.optionLabel}>Within (days)</span>
          <div className={styles.optionControl}>
            <input
              type="number"
              min={0}
              className={styles.labelInput}
              value={config.windowDays ?? ''}
              placeholder="No limit"
              onChange={e => onChange({ ...config, windowDays: optionalNumber(e.target.value) })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Show</span>
          <div className={styles.optionControl}>
            <input
              type="number"
              min={1}
              max={50}
              className={styles.labelInput}
              value={config.limit ?? 7}
              onChange={e =>
                onChange({ ...config, limit: Math.max(1, optionalNumber(e.target.value) ?? 7) })
              }
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Include overdue</span>
          <div className={styles.optionControl}>
            <input
              type="checkbox"
              checked={config.includeOverdue ?? false}
              onChange={e => onChange({ ...config, includeOverdue: e.target.checked || undefined })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Subtitle field id</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.sublabelFieldId ?? ''}
              onChange={e => onChange({ ...config, sublabelFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Value field id</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.valueFieldId ?? ''}
              onChange={e => onChange({ ...config, valueFieldId: optionalText(e.target.value) })}
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
