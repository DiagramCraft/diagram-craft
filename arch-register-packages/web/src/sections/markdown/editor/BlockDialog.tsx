import type React from 'react';
import styles from './BlockDialog.module.css';

export const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.content}>{children}</div>
);
