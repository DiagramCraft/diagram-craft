import type { CSSProperties, ReactNode } from 'react';
import styles from './FormCheckboxList.module.css';

export type FormCheckboxListProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export type FormCheckboxListRowProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
};

const FormCheckboxListRow = ({ label, children, className }: FormCheckboxListRowProps) => (
  <label className={`${styles.eRow} ${className ?? ''}`}>
    {children}
    <span>{label}</span>
  </label>
);

const FormCheckboxListComponent = ({ children, className, style }: FormCheckboxListProps) => (
  <div className={`${styles.cFormCheckboxList} ${className ?? ''}`} style={style}>
    {children}
  </div>
);

export const FormCheckboxList = Object.assign(FormCheckboxListComponent, {
  Row: FormCheckboxListRow
});
