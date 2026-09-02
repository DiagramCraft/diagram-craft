import { useEffect, useState } from 'react';
import { TbCheck, TbCopy } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './QueryPreview.module.css';

type QueryPreviewProps = {
  text: string;
};

export const QueryPreview = ({ text }: QueryPreviewProps) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copied = copiedText === text && text !== '';

  useEffect(() => {
    if (copiedText === null) return;
    const timeout = setTimeout(() => setCopiedText(null), 1500);
    return () => clearTimeout(timeout);
  }, [copiedText]);

  const copy = async () => {
    if (!text || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
    } catch {
      // Clipboard permissions can be unavailable in embedded or non-secure contexts. The preview
      // remains usable even when copying is not permitted.
      setCopiedText(null);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>Query</span>
        <Button
          size="xs"
          variant="ghost"
          icon={copied ? <TbCheck size={12} /> : <TbCopy size={12} />}
          disabled={!text}
          onClick={() => void copy()}
          aria-label={copied ? 'Query copied' : 'Copy query'}
          title={copied ? 'Query copied' : 'Copy query'}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className={styles.text}>{text || '(empty)'}</pre>
    </div>
  );
};
