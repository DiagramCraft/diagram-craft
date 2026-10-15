import type { ReactNode } from 'react';
import styles from './Tab.module.css';

export const Tab = ({ children }: { label?: string; children?: ReactNode }) => {
  return (
    <div role="tabpanel" className={styles.panel}>
      {children}
    </div>
  );
};
