import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { normalizeApiError } from '../../lib/http';
import type { UploadApiSpecificationInput } from '../../hooks/useArtifacts';
import styles from './UploadApiSpecificationDialog.module.css';

const MAX_UPLOAD_BYTES = 2_000_000;
const ACCEPTED_FILE_TYPES = '.json,.yaml,.yml,application/json,application/yaml,text/yaml';
const SUPPORTED_EXTENSIONS = /\.(json|ya?ml)$/i;

type Props = {
  open: boolean;
  onClose: () => void;
  onUpload: (input: UploadApiSpecificationInput) => Promise<unknown>;
  isPending: boolean;
};

const getMediaType = (file: File) => {
  if (file.name.toLowerCase().endsWith('.json')) return 'application/json';
  return 'application/yaml';
};

export const UploadApiSpecificationDialog = ({ open, onClose, onUpload, isPending }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!file) {
      setError('Select an OpenAPI or AsyncAPI file to upload.');
      return;
    }
    if (!SUPPORTED_EXTENSIONS.test(file.name)) {
      setError('Use a JSON, YAML, or YML file.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('The API specification must be 2 MB or smaller.');
      return;
    }

    setError('');
    try {
      const content = await file.text();
      if (content.trim().length === 0) {
        setError('The selected file is empty.');
        return;
      }
      await onUpload({
        content,
        mediaType: getMediaType(file),
        sourceRevision: file.name
      });
      onClose();
    } catch (uploadError) {
      setError(normalizeApiError(uploadError).message);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Upload API specification"
      sub="Upload an OpenAPI or AsyncAPI document to make its operations or messages browseable."
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: isPending ? 'Uploading…' : 'Upload specification',
          type: 'default',
          disabled: isPending,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <form className={styles.form} onSubmit={event => void handleSubmit(event)}>
        <button type="submit" hidden />
        <FormElement
          label="Specification file"
          hint="JSON, YAML, and YML files up to 2 MB are supported."
        >
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            disabled={isPending}
            onChange={event => {
              setFile(event.target.files?.[0] ?? null);
              setError('');
            }}
          />
        </FormElement>
        {file && <div className={styles.selectedFile}>Selected: {file.name}</div>}
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
};
