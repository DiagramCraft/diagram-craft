import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { GroupedRollupTableWidgetConfig } from './GroupedRollupTableWidget';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  config: GroupedRollupTableWidgetConfig;
  onChange: (config: GroupedRollupTableWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const Toggle = ({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className={styles.optionRow}>
    <span className={styles.optionLabel}>{label}</span>
    <div className={styles.optionControl}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </div>
  </label>
);

export const GroupedRollupTableConfigForm = ({ config, onChange }: Props) => (
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
    <DialogSection label="Sum field id" required>
      <input
        type="text"
        className={styles.labelInput}
        value={config.valueFieldId}
        placeholder="e.g. spend"
        onChange={e => onChange({ ...config, valueFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={styles.options}>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Group by field id</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.groupFieldId ?? ''}
              placeholder="Blank = one row per record"
              onChange={e => onChange({ ...config, groupFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Group column title</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.groupLabel ?? ''}
              placeholder="Name"
              onChange={e => onChange({ ...config, groupLabel: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Value column title</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
              value={config.valueLabel ?? ''}
              placeholder="Total"
              onChange={e => onChange({ ...config, valueLabel: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <Toggle
          label="Bars"
          checked={config.showBar ?? false}
          onChange={checked => onChange({ ...config, showBar: checked || undefined })}
        />
        <Toggle
          label="Share %"
          checked={config.showPercent ?? false}
          onChange={checked => onChange({ ...config, showPercent: checked || undefined })}
        />
        <Toggle
          label="Record count"
          checked={config.showCount ?? false}
          onChange={checked => onChange({ ...config, showCount: checked || undefined })}
        />
        <Toggle
          label="Total row"
          checked={config.showTotal ?? true}
          onChange={checked => onChange({ ...config, showTotal: checked ? undefined : false })}
        />
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
