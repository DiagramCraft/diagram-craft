import { ReactNode, CSSProperties } from 'react';
import styles from './FormElement.module.css';

export type FormElementProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  style?: CSSProperties;
  className?: string;
};

export const FormElement = ({
  label,
  required = false,
  hint,
  error,
  children,
  htmlFor,
  style,
  className
}: FormElementProps) => {
  const hintId = hint ? `${htmlFor ?? 'field'}-hint` : undefined;
  const errorId = error ? `${htmlFor ?? 'field'}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`${styles.cFormElement} ${className ?? ''}`} style={style}>
      <label className={styles.eLabel} htmlFor={htmlFor}>
        {label}
        {required && <span className={styles.eRequired} aria-label="required">*</span>}
      </label>
      <div
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      >
        {children}
      </div>
      {hint && !error && (
        <div id={hintId} className={styles.eHint}>
          {hint}
        </div>
      )}
      {error && (
        <div id={errorId} className={styles.eError} role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
