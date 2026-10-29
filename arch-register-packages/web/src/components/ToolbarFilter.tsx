import type { ReactNode } from 'react';
import styles from './ToolbarFilter.module.css';

/** Row holding a table/list's search box and filter controls. */
export const ToolbarFilterBar = ({
  children,
  noPadding
}: {
  children: ReactNode;
  /** Remove the vertical padding, e.g. when the parent already provides spacing. */
  noPadding?: boolean;
}) => (
  <div className={`${styles.toolbar} ${noPadding ? styles.toolbarNoPadding : ''}`}>{children}</div>
);

/** Compact labelled date input (yyyy-mm-dd), e.g. "From  2026-01-01". */
export const ToolbarFilterDate = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className={styles.filter}>
    <span className={styles.filterLabel}>{label}</span>
    <input
      type="date"
      className={styles.filterControl}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </label>
);
