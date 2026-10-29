import type { ReactNode } from 'react';
import controlStyles from './LabeledControl.module.css';
import styles from './LabeledValue.module.css';

/** Read-only counterpart of `LabeledSelect`, e.g. "Type  System". */
export const LabeledValue = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className={`${controlStyles.cLabeledControl} ${styles.cLabeledValue}`}>
    <span className={controlStyles.eLabel}>{label}</span>
    <span className={styles.eValue}>{value}</span>
  </div>
);
