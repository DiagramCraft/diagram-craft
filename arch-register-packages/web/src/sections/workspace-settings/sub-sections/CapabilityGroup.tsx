import type { ReactNode } from 'react';
import styles from './CapabilityGroup.module.css';

/** Bordered card with a header (icon, label, action) used for the capability groups in the role editor. */
export const CapabilityGroup = ({
  label,
  icon,
  action,
  children
}: {
  label: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <div className={styles.group}>
    <div className={styles.head}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{label}</span>
      {action && <span className={styles.action}>{action}</span>}
    </div>
    <div className={styles.body}>{children}</div>
  </div>
);
