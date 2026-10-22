import type { ReactNode } from 'react';
import styles from './SettingsBlock.module.css';

/** Vertical stack of {@link SettingsBlock}s with the standard settings page padding. */
export const SettingsBlockList = ({ children }: { children: ReactNode }) => (
  <div className={styles.list}>{children}</div>
);

/** Bordered settings panel with a title, optional description and a body. */
export const SettingsBlock = ({
  title,
  description,
  children
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <div className={styles.block}>
    <div className={styles.head}>
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.description}>{description}</div>}
    </div>
    <div className={styles.body}>{children}</div>
  </div>
);
