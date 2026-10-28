import type { ReactNode } from 'react';
import styles from './EntityTabPage.module.css';

/** The padded, vertically stacked page every entity detail tab renders its content in. */
export const EntityTabPage = ({ children }: { children: ReactNode }) => (
  <div className={styles.page}>{children}</div>
);
