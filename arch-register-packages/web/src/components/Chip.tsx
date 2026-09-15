import { type ReactNode } from 'react';
import styles from './Chip.module.css';

type ChipProps = {
  children: ReactNode;
  tone?: 'default' | 'ghost' | 'accent';
  icon?: ReactNode;
  dot?: string;
  /** Tints the chip's own border and text this color, leaving the background transparent —
   *  the "colored outline pill" look (e.g. an effectiveness/status label), as opposed to `dot`'s
   *  neutral pill with a small colored marker next to plain text. */
  color?: string;
  title?: string;
};

export const Chip = ({ children, tone = 'default', icon, dot, color, title }: ChipProps) => (
  <span
    className={`${styles.chip} ${tone === 'ghost' ? styles.ghost : ''} ${tone === 'accent' ? styles.accent : ''}`}
    style={color ? { borderColor: color, color } : undefined}
    title={title}
  >
    {dot && <span className={styles.dot} style={{ background: dot }} />}
    {icon}
    {children}
  </span>
);
