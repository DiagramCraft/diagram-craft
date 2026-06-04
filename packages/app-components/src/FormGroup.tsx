import { ReactNode, CSSProperties } from 'react';
import styles from './FormGroup.module.css';

export type FormGroupProps = {
  label: string;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export const FormGroup = ({ label, icon, action, children, className, style }: FormGroupProps) => (
  <div className={`${styles.cFormGroup} ${className ?? ''}`} style={style}>
    <div className={styles.eHead}>
      {icon && <span className={styles.eIcon}>{icon}</span>}
      <span className={styles.eLabel}>{label}</span>
      {action && <span className={styles.eAction}>{action}</span>}
    </div>
    {children}
  </div>
);
