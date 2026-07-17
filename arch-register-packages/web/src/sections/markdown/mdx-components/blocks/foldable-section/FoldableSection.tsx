import type { ReactNode } from 'react';
import styles from './FoldableSection.module.css';

export const FoldableSection = ({ label, children }: { label?: string; children?: ReactNode }) => {
  return (
    <details className={styles.container}>
      <summary className={styles.summary}>
        {label && label.trim() !== '' ? label : 'Details'}
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
};
