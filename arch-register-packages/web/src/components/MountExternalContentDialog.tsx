import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { ExternalContentMount } from '@arch-register/api-types/externalContentContract';
import { ApiError } from '../lib/http';
import { useExternalContentOperations } from '../hooks/useExternalContent';
import styles from '../dialogs/AddEntityDialog.module.css';

type Props = {
  workspaceId: string;
  open: boolean;
  mount?: ExternalContentMount | null;
  onClose: () => void;
};

export const MountExternalContentDialog = ({ workspaceId, open, mount, onClose }: Props) => {
  const [url, setUrl] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [mountPoint, setMountPoint] = useState('');
  const [intervalHours, setIntervalHours] = useState('1');
  const [error, setError] = useState('');
  const mountPointRef = useRef<HTMLInputElement>(null);
  const operations = useExternalContentOperations(workspaceId);
  const editing = !!mount;

  useEffect(() => {
    if (!open) return;
    setUrl(mount?.source.source_config.url ?? '');
    setSourcePath(mount?.source_path ?? '');
    setMountPoint(mount?.destination_path ?? '');
    setIntervalHours(String(mount?.interval_hours ?? 1));
    setError('');
    setTimeout(() => mountPointRef.current?.focus(), 30);
  }, [open, mount]);

  const handleSubmit = async () => {
    const trimmedUrl = url.trim();
    const trimmedMountPoint = mountPoint.trim();
    if (!trimmedUrl || !trimmedMountPoint) {
      setError('Mount point and repository URL are required');
      return;
    }
    const interval = Number(intervalHours);
    if (!Number.isInteger(interval) || interval < 1) {
      setError('Refresh interval must be a positive number of hours');
      return;
    }

    setError('');
    try {
      const body = {
        source: { type: 'git' as const, url: trimmedUrl },
        destination_path: trimmedMountPoint,
        source_path: sourcePath.trim(),
        interval_hours: interval
      };
      if (mount) {
        await operations.update.mutateAsync({ id: mount.id, ...body });
        onClose();
      } else {
        await operations.create.mutateAsync({ ...body, scope: { type: 'workspace' } });
        setUrl('');
        setSourcePath('');
        setMountPoint('');
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : editing
            ? 'Unable to update content mount'
            : 'Unable to create content mount'
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Git mount' : 'Mount Git repository'}
      sub="Public HTTPS repositories are synchronized into workspace content."
      width={620}
      buttons={[
        { label: 'Close', type: 'cancel', onClick: onClose },
        {
          label: editing
            ? operations.update.isPending
              ? 'Saving…'
              : 'Save changes'
            : operations.create.isPending
              ? 'Mounting…'
              : 'Mount repository',
          type: 'default',
          disabled: operations.create.isPending || operations.update.isPending,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <form
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <button type="submit" hidden />
        <FormElement
          label="Mount point"
          required
          hint="A top-level folder in workspace content; slashes are not supported yet."
        >
          <TextInput
            ref={mountPointRef}
            value={mountPoint}
            onChange={value => setMountPoint((value ?? '').replaceAll('/', ''))}
            placeholder="vendor-docs"
            style={{ width: '100%' }}
          />
        </FormElement>
        <FormElement
          label="Repository HTTPS URL"
          required
          hint="Authentication is not supported yet."
        >
          <TextInput
            value={url}
            onChange={value => setUrl(value ?? '')}
            placeholder="https://github.com/org/repository.git"
            type="url"
            style={{ width: '100%' }}
          />
        </FormElement>
        <FormElement
          label="Repository path"
          required={false}
          hint="Leave empty to mount the repository root."
        >
          <TextInput
            value={sourcePath}
            onChange={value => setSourcePath(value ?? '')}
            placeholder="docs"
            style={{ width: '100%' }}
          />
        </FormElement>
        <FormElement
          label="Refresh interval (hours)"
          required={false}
          hint="This interval applies to all mounts using the same repository URL."
        >
          <TextInput
            value={intervalHours}
            onChange={value => setIntervalHours(value ?? '')}
            type="number"
            min={1}
            step={1}
            style={{ width: 100 }}
          />
        </FormElement>
        {error && <div className={styles.error}>{error}</div>}
      </form>
    </Dialog>
  );
};
