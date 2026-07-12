import { type ReactNode } from 'react';
import styles from './Banner.module.css';

type BannerProps = {
  variant: 'error' | 'warning' | 'info';
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
};

export const Banner = ({ variant, icon, children, action }: BannerProps) => (
  <div
    className={styles.banner}
    data-variant={variant}
    role={variant === 'error' ? 'alert' : undefined}
  >
    {icon && <span className={styles.icon}>{icon}</span>}
    <span className={styles.content}>{children}</span>
    {action && <span className={styles.action}>{action}</span>}
  </div>
);
