import type React from 'react';
import styles from './BlockDialog.module.css';

export const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.content}>{children}</div>
);

export const DialogSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className={styles.section}>
    <div className={styles.sectionLabel}>{label}</div>
    {children}
  </div>
);
