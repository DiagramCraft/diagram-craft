import type { CSSProperties, ReactNode } from 'react';
import styles from './FormGroup.module.css';

export type FormGroupProps = {
  variant: 'border' | 'section' | 'simple';
  label: string;
  supplementaryLabel?: string;
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
                            style,
                            supplementaryLabel
                          }: FormGroupProps) => {
  const hasIcon = icon !== undefined && icon !== null && typeof icon !== 'boolean';
  const hasAction = action !== undefined && action !== null && typeof action !== 'boolean';
  const iconIsStep = typeof icon === 'string' || typeof icon === 'number';

  return (
    <div className={`${styles.cFormGroup} ${className ?? ''}`}
         data-variant={variant}
         style={style}>
      <div className={styles.eHead}>
        {hasIcon &&
          (iconIsStep ? (
            <span className={styles.eTextIcon}>{icon}</span>
          ) : (
            <span className={styles.eIcon}>{icon}</span>
          ))}
        <span className={styles.eLabel}>{label}</span>
        {supplementaryLabel &&
            <span className={styles.eLabel + " " + styles.eSupplementaryLabel}>{supplementaryLabel}</span>}
        {hasAction && <span className={styles.eAction}>{action}</span>}
      </div>
      <div className={styles.eBody}>{children}</div>
    </div>
  );
};
