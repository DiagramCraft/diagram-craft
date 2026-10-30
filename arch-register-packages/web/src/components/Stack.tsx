import type { ReactNode } from 'react';
import styles from './Stack.module.css';

export const Stack = ({ children }: { children: ReactNode }) => (
  <div className={styles.cStack}>{children}</div>
);
