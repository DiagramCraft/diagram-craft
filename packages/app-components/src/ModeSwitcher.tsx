import { ReactNode } from 'react';
import styles from './ModeSwitcher.module.css';

export type ModeSwitcherMode<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

export type ModeSwitcherProps<T extends string> = {
  modes: readonly ModeSwitcherMode<T>[];
  value: T;
  onChange: (value: T) => void;
};

export const ModeSwitcher = <T extends string>({
  modes,
  value,
  onChange
}: ModeSwitcherProps<T>) => (
  <div className={styles.cModeSwitcher}>
    {modes.map(m => (
      <button
        key={m.value}
        type="button"
        className={styles.eBtn}
        data-active={String(value === m.value)}
        onClick={() => onChange(m.value)}
      >
        {m.icon && <span className={styles.eIcon}>{m.icon}</span>}
        {m.label}
      </button>
    ))}
  </div>
);
