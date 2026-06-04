import { ReactNode } from 'react';
import styles from './FormSection.module.css';

export type FormSectionProps = {
  step?: number | string;
  title: string;
  children: ReactNode;
  className?: string;
};

export const FormSection = ({ step, title, children, className }: FormSectionProps) => (
  <div className={`${styles.cFormSection} ${className ?? ''}`}>
    <div className={styles.eHead}>
      {step !== undefined && <span className={styles.eStep}>{step}</span>}
      <span className={styles.eTitle}>{title}</span>
    </div>
    <div className={styles.eBody}>{children}</div>
  </div>
);
