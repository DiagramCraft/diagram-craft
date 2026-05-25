import { type ReactNode } from 'react';
import styles from './Chip.module.css';

type ChipProps = {
  children: ReactNode;
  tone?: 'default' | 'ghost';
  icon?: ReactNode;
  dot?: string;
};

export const Chip = ({ children, tone = 'default', icon, dot }: ChipProps) => (
  <span className={`${styles.chip} ${tone === 'ghost' ? styles.ghost : ''}`}>
    {dot && <span className={styles.dot} style={{ background: dot }} />}
    {icon}
    {children}
  </span>
);
