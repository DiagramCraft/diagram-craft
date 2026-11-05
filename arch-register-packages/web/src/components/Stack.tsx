import type { ReactNode } from 'react';
import styles from './Stack.module.css';

export const Stack = ({ children, size }: { children: ReactNode; size?: 'sm' | 'md' }) => (
  <div data-size={size ?? 'md'} className={styles.cStack}>
    {children}
  </div>
);
