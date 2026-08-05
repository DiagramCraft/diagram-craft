import { Field } from '@base-ui/react/field';
import { ReactElement, ReactNode, CSSProperties, useId, isValidElement, cloneElement } from 'react';
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
  required = true,
  hint,
  error,
  children,
  htmlFor,
  style,
  className
}: FormElementProps) => {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const hintId = hint && !error ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // Only wire id/aria-describedby onto a single element child, and only when the
  // caller hasn't already taken ownership of association via htmlFor, or already
  // set these props themselves.
  const wiredChild =
    isValidElement(children) && !htmlFor
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id: (children.props as Record<string, unknown>).id ?? controlId,
          'aria-describedby':
            (children.props as Record<string, unknown>)['aria-describedby'] ?? describedBy
        })
      : children;

  return (
    <Field.Root
      className={`${styles.cFormElement} ${className ?? ''}`}
      style={style}
      invalid={!!error}
    >
      <Field.Label className={styles.eLabel} htmlFor={controlId}>
        {label}
        {!required && <span className={styles.eOptional}>(optional)</span>}
      </Field.Label>
      <div>{wiredChild}</div>
      {hint && !error && (
        <Field.Description id={hintId} className={styles.eHint}>
          {hint}
        </Field.Description>
      )}
      {error && (
        <Field.Error match id={errorId} role="alert" className={styles.eError}>
          {error}
        </Field.Error>
      )}
    </Field.Root>
  );
};
