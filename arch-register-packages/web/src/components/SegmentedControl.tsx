import type { ReactNode } from 'react';
import styles from './SegmentedControl.module.css';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
  title?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
};

/** Joined group of buttons where exactly one is active, e.g. a zoom level switcher. */
export const SegmentedControl = <T extends string>({
  value,
  onChange,
  options
}: SegmentedControlProps<T>) => (
  <div className={styles.cSegmentedControl}>
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        className={styles.eSegment}
        aria-pressed={o.value === value}
        title={o.title}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);
