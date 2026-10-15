import type { ReactNode } from 'react';
import styles from './Column.module.css';

export const Column = ({ children }: { children?: ReactNode }) => {
  return <div className={styles.column}>{children}</div>;
};
