import type { CSSProperties, ReactNode } from 'react';
import styles from './FormCheckboxList.module.css';

export type FormCheckboxListProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  columns?: number;
};

export type FormCheckboxListRowProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

const FormCheckboxListRow = ({
  label,
  children,
  className,
  style,
  title
}: FormCheckboxListRowProps) => (
  <label className={`${styles.eRow} ${className ?? ''}`} style={style} title={title}>
    {children}
    <span>{label}</span>
  </label>
);

const FormCheckboxListComponent = ({
  children,
  className,
  style,
  columns
}: FormCheckboxListProps) => (
  <div
    className={`${styles.cFormCheckboxList} ${className ?? ''}`}
    data-columns={columns}
    style={
      {
        ...(columns ? { '--columns': columns } : {}),
        ...style
      } as CSSProperties
    }
  >
    {children}
  </div>
);

export const FormCheckboxList = Object.assign(FormCheckboxListComponent, {
  Row: FormCheckboxListRow
});
