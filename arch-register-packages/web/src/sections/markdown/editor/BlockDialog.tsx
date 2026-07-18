import type React from 'react';
import styles from './BlockDialog.module.css';

export const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.content}>{children}</div>
);

export const DialogSection = ({
  label,
  required = true,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className={styles.section}>
    <div className={styles.sectionLabel}>
      {label}
      {!required && <span className={styles.optionalLabel}> (optional)</span>}
    </div>
    {children}
  </div>
);
