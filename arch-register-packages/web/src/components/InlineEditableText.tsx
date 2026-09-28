import { useLayoutEffect, useRef } from 'react';
import styles from './InlineEditableText.module.css';

type Props = {
  value: string;
  placeholder?: string;
  ariaLabel: string;
  testId?: string;
  onChange: (value: string) => void;
};

export const InlineEditableText = ({ value, placeholder, ariaLabel, testId, onChange }: Props) => {
  const ref = useRef<HTMLSpanElement>(null);
  const initialValue = useRef(value);

  // Uncontrolled after mount, so React never resets the caret while typing.
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = initialValue.current;
  }, []);

  return (
    // biome-ignore lint/a11y/useSemanticElements: a native input can't inherit the surrounding heading typography or wrap inline
    <span
      ref={ref}
      className={styles.editable}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      data-testid={testId}
      onInput={e => onChange(e.currentTarget.textContent ?? '')}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
};
