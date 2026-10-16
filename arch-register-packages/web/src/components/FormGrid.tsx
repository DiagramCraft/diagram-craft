import type { CSSProperties, ReactNode } from 'react';
import styles from './FormGrid.module.css';

export type FormGridProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export type FormGridRowProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
};

const FormGridRow = ({ label, children, className }: FormGridRowProps) => (
  <label className={`${styles.eRow} ${className ?? ''}`}>
    <span className={styles.eLabel}>{label}</span>
    <div className={styles.eControl}>{children}</div>
  </label>
);

const FormGridComponent = ({ children, className, style }: FormGridProps) => (
  <div className={`${styles.cFormGrid} ${className ?? ''}`} style={style}>
    {children}
  </div>
);

export const FormGrid = Object.assign(FormGridComponent, { Row: FormGridRow });
