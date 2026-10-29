import styles from './ToolbarFilterDate.module.css';

/** Compact labelled date input (yyyy-mm-dd), e.g. "From  2026-01-01". */
export const ToolbarFilterDate = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className={styles.filter}>
    <span className={styles.filterLabel}>{label}</span>
    <input
      type="date"
      className={styles.filterControl}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </label>
);
