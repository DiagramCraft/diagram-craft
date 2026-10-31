import type { ReactNode } from 'react';
import styles from './Panel.module.css';

export const Panel = ({ children }: { children: ReactNode }) => (
  <div className={`surface ${styles.cPanel}`}>{children}</div>
);
