import type { CSSProperties, ReactNode } from 'react';
import styles from './FormGroup.module.css';

export type FormGroupProps = {
  variant: 'border' | 'section';
  label: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export const FormGroup = ({
                            variant,
                            label,
                            icon,
                            action,
                            children,
                            className,
                            style
                          }: FormGroupProps) => {
  const variantClass = variant === 'border' ? styles.isBorder : styles.isSection;
  const hasIcon = icon !== undefined && icon !== null && typeof icon !== 'boolean';
  const hasAction = action !== undefined && action !== null && typeof action !== 'boolean';
  const iconIsStep = typeof icon === 'string' || typeof icon === 'number';

  return (
    <div className={`${styles.cFormGroup} ${variantClass} ${className ?? ''}`} style={style}>
      <div className={styles.eHead}>
        {hasIcon &&
          (iconIsStep ? (
            <span className={styles.eStep}>{icon}</span>
          ) : (
            <span className={styles.eIcon}>{icon}</span>
          ))}
        <span className={styles.eLabel}>{label}</span>
        {hasAction && <span className={styles.eAction}>{action}</span>}
      </div>
      <div className={styles.eBody}>{children}</div>
    </div>
  );
};
