import type { ReactNode } from 'react';
import { Stack } from './Stack';
import styles from './Page.module.css';

export const Page = ({ children }: { children: ReactNode }) => (
  <div className={styles.cPage}>
    <Stack>{children}</Stack>
  </div>
);
