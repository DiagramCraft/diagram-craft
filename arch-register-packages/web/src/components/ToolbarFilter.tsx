import type { ReactNode } from 'react';
import styles from './ToolbarFilter.module.css';

/** Row holding a table/list's search box and filter controls. */
export const ToolbarFilterBar = ({ children }: { children: ReactNode }) => (
  <div className={styles.toolbar}>{children}</div>
);

/** Compact labelled select, e.g. "Role  Any role". */
export const ToolbarFilterSelect = ({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <label className={styles.filter}>
    <span className={styles.filterLabel}>{label}</span>
    <select className={styles.filterControl} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
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
