import controlStyles from './LabeledControl.module.css';
import styles from './LabeledDateInput.module.css';

/** Compact labelled date input (yyyy-mm-dd), e.g. "From  2026-01-01". */
export const LabeledDateInput = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className={`${controlStyles.cLabeledControl} ${styles.cLabeledDateInput}`}>
    <span className={controlStyles.eLabel}>{label}</span>
    <input
      type="date"
      className={styles.eInput}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </label>
);
