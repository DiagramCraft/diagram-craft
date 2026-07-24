import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './WikiCommentComposer.module.css';

export const Composer = ({
  placeholder,
  submitLabel = 'Comment',
  autoFocus,
  initialValue = '',
  onSubmit,
  onCancel
}: {
  placeholder: string;
  submitLabel?: string;
  autoFocus?: boolean;
  initialValue?: string;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
}) => {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
    <div className={styles.composer}>
      <textarea
        className={styles.composerInput}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        rows={2}
        onChange={e => setValue(e.target.value)}
      />
      <div className={styles.composerRow}>
        {onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!trimmed}
          onClick={() => {
            if (!trimmed) return;
            onSubmit(trimmed);
            setValue('');
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
