import type { ReactNode } from 'react';
import styles from './WidgetFrame.module.css';

type Props = {
  children: ReactNode;
};

export const WidgetFrame = ({ children }: Props) => (
  <div className={styles.frame}>
    <div className={styles.body}>{children}</div>
  </div>
);
