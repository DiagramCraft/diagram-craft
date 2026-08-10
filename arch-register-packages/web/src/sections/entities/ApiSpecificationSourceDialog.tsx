import { useEffect, useState, type FormEvent } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { normalizeApiError } from '../../lib/http';
import type { ApiSpecificationSourceInput } from '../../hooks/useArtifacts';
import styles from './ApiSpecificationSourceDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: ApiSpecificationSourceInput) => Promise<unknown>;
  isPending: boolean;
};

type SourceKind = ApiSpecificationSourceInput['kind'];

const sourceLabel = (kind: SourceKind) => (kind === 'url' ? 'HTTPS URL' : 'External link');

const validateLocation = (kind: SourceKind, value: string) => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return 'Enter a valid absolute URL.';
  }
  if (url.protocol !== 'https:') return 'Use an HTTPS URL.';
  if (url.username || url.password) return 'URLs must not contain credentials.';
  if (kind === 'url' && url.hash) return 'URL sources must not contain a fragment.';
  return null;
};

export const ApiSpecificationSourceDialog = ({ open, onClose, onCreate, isPending }: Props) => {
  const [kind, setKind] = useState<SourceKind | null>(null);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setKind(null);
      setLocation('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!kind) return;
    const trimmed = location.trim();
    const validationError = validateLocation(kind, trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    try {
      await onCreate({ kind, location: trimmed });
      onClose();
    } catch (createError) {
      setError(normalizeApiError(createError).message);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add API source"
      sub="Link an external API document or fetch it into the normalized API catalog."
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        ...(kind
          ? [
              {
                label: isPending ? 'Adding…' : 'Add source',
                type: 'default' as const,
                disabled: isPending,
                onClick: () => {
                  void handleSubmit();
                }
              }
            ]
          : [])
      ]}
    >
      {!kind ? (
        <div className={styles.options}>
          <button type="button" className={styles.option} onClick={() => setKind('link')}>
            <span className={styles.optionTitle}>External link</span>
            <span className={styles.optionDescription}>
              Show a canonical source link without importing operations.
            </span>
          </button>
          <button type="button" className={styles.option} onClick={() => setKind('url')}>
            <span className={styles.optionTitle}>HTTPS URL</span>
            <span className={styles.optionDescription}>
              Fetch, validate, and refresh the API specification automatically.
            </span>
          </button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={event => void handleSubmit(event)}>
          <button type="submit" hidden />
          <button
            type="button"
            className={styles.back}
            disabled={isPending}
            onClick={() => {
              setKind(null);
              setLocation('');
              setError('');
            }}
          >
            ← Choose another source type
          </button>
          <FormElement
            label={sourceLabel(kind)}
            hint={
              kind === 'url'
                ? 'The source is fetched securely and limited to 2 MB.'
                : 'The link is stored as metadata only; no normalized operations are imported.'
            }
          >
            <input
              className={styles.input}
              type="url"
              value={location}
              autoFocus
              disabled={isPending}
              placeholder="https://example.com/openapi.yaml"
              onChange={event => {
                setLocation(event.target.value);
                setError('');
              }}
            />
          </FormElement>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
        </form>
      )}
    </Dialog>
  );
};
