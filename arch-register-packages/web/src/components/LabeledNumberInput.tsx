import controlStyles from './LabeledControl.module.css';
import styles from './LabeledNumberInput.module.css';

/** Compact labelled number input with an optional unit suffix, e.g. "Not changed in  90 days". */
export const LabeledNumberInput = ({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
  onEnter
}: {
  label: string;
  suffix?: string;
  value: string;
  min?: number;
  max?: number;
  onChange: (value: string) => void;
  /** Called when Enter is pressed in the input. */
  onEnter?: () => void;
}) => (
  <label className={`${controlStyles.cLabeledControl} ${styles.cLabeledNumberInput}`}>
    <span className={controlStyles.eLabel}>{label}</span>
    <input
      type="number"
      className={styles.eInput}
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onEnter?.();
      }}
    />
    {suffix && <span className={styles.eSuffix}>{suffix}</span>}
  </label>
);
