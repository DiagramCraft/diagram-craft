import type { ChangeEvent, KeyboardEvent } from 'react';
import { TbAlertTriangle } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './AdvancedQueryEditor.module.css';

export type AdvancedQueryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFormat: () => void;
  onClear: () => void;
  error?: string;
  formatPending?: boolean;
};

export const AdvancedQueryEditor = ({
  value,
  onChange,
  onSubmit,
  onFormat,
  onClear,
  error,
  formatPending = false
}: AdvancedQueryEditorProps) => {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className={styles.root}>
      <textarea
        className={styles.input}
        aria-label="Advanced query"
        placeholder="Enter a query…"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={4}
      />
      <div className={styles.actions}>
        <Button
          size="xs"
          variant="secondary"
          onClick={onFormat}
          disabled={formatPending}
          title="Format query"
        >
          Format
        </Button>
        <Button size="xs" variant="ghost" onClick={onClear} disabled={!value} title="Clear query">
          Clear
        </Button>
        <span className={styles.hint}>Ctrl/Cmd+Enter to apply</span>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <TbAlertTriangle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
