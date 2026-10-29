import type { ReactNode } from 'react';
import styles from './Columns.module.css';

export const Columns = ({ count, children }: { count?: string; children?: ReactNode }) => {
  const resolvedCount = count === '3' ? '3' : '2';
  return (
    <div
      data-count={resolvedCount}
      className={`${styles.grid} ${resolvedCount === '3' ? styles.threeCol : styles.twoCol}`}
    >
      {children}
    </div>
  );
};
