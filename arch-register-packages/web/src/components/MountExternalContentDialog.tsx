import { useEffect, useRef, useState } from 'react';
import { TbGitBranch, TbRefresh, TbTrash } from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import type { ExternalContentMount } from '@arch-register/api-types/externalContentContract';
import { ApiError } from '../lib/http';
import {
  useExternalContentMounts,
  useExternalContentOperations
} from '../hooks/useExternalContent';
import styles from '../dialogs/AddEntityDialog.module.css';

type Props = {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
};

const formatStatus = (mount: ExternalContentMount) => {
  if (mount.status === 'syncing' || mount.source.status === 'syncing') return 'Syncing…';
  if (mount.status === 'failed' || mount.source.status === 'failed') {
    return mount.last_error ?? mount.source.last_error ?? 'Sync failed';
  }
  if (mount.last_synced_at) return `Synced ${new Date(mount.last_synced_at).toLocaleString()}`;
  return 'Waiting for initial sync';
};

export const MountExternalContentDialog = ({ workspaceId, open, onClose }: Props) => {
  const [url, setUrl] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [intervalHours, setIntervalHours] = useState('1');
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<ExternalContentMount | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const mounts = useExternalContentMounts(workspaceId, open);
  const operations = useExternalContentOperations(workspaceId);

  useEffect(() => {
    if (!open) return;
    setUrl('');
    setSourcePath('');
    setDestinationPath('');
    setIntervalHours('1');
    setError('');
    setTimeout(() => urlRef.current?.focus(), 30);
  }, [open]);

  const handleCreate = async () => {
    const trimmedUrl = url.trim();
    const trimmedDestination = destinationPath.trim();
    if (!trimmedUrl || !trimmedDestination) {
      setError('Repository URL and destination path are required');
      return;
    }
    const interval = Number(intervalHours);
    if (!Number.isInteger(interval) || interval < 1) {
      setError('Refresh interval must be a positive number of hours');
      return;
    }

    setError('');
    try {
      await operations.create.mutateAsync({
        source: { type: 'git', url: trimmedUrl },
        scope: { type: 'workspace' },
        destination_path: trimmedDestination,
        source_path: sourcePath.trim(),
        interval_hours: interval
      });
      setUrl('');
      setSourcePath('');
      setDestinationPath('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create content mount');
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    try {
      await operations.remove.mutateAsync(removeTarget.id);
      setRemoveTarget(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to remove content mount');
      setRemoveTarget(null);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Mount Git repository"
        sub="Public HTTPS repositories are synchronized into workspace content."
        width={620}
        buttons={[{ label: 'Close', type: 'cancel', onClick: onClose }]}
      >
        <form
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <FormElement label="Repository HTTPS URL" required hint="Authentication is not supported yet.">
            <TextInput
              ref={urlRef}
              value={url}
              onChange={value => setUrl(value ?? '')}
              placeholder="https://github.com/org/repository.git"
              type="url"
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Repository path" hint="Leave empty to mount the repository root.">
            <TextInput
              value={sourcePath}
              onChange={value => setSourcePath(value ?? '')}
              placeholder="docs"
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Workspace destination path" required hint="For example: vendor/docs">
            <TextInput
              value={destinationPath}
              onChange={value => setDestinationPath(value ?? '')}
              placeholder="vendor/docs"
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Refresh interval (hours)">
            <TextInput
              value={intervalHours}
              onChange={value => setIntervalHours(value ?? '')}
              type="number"
              min={1}
              step={1}
              style={{ width: 100 }}
            />
          </FormElement>
          <Button
            variant="primary"
            disabled={operations.create.isPending}
            icon={<TbGitBranch size={13} />}
          >
            {operations.create.isPending ? 'Mounting…' : 'Mount repository'}
          </Button>
          {error && <div className={styles.error}>{error}</div>}
        </form>

        <div style={{ marginTop: 24, display: 'grid', gap: 8 }}>
          <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
            Existing mounts
          </div>
          {mounts.isLoading && <div className="dim">Loading mounts…</div>}
          {!mounts.isLoading && mounts.data?.length === 0 && (
            <div className="dim">No external repositories are mounted.</div>
          )}
          {mounts.data?.map(mount => (
            <div
              key={mount.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                alignItems: 'center',
                padding: '8px 0',
                borderTop: '1px solid var(--panel-border, #ddd)'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mount.destination_path}
                </div>
                <div className="dim" style={{ fontSize: 12 }}>
                  {mount.source.source_config.url} · {formatStatus(mount)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button
                  variant="icon-only"
                  title="Sync now"
                  disabled={operations.sync.isPending}
                  onClick={() => void operations.sync.mutateAsync(mount.id)}
                >
                  <TbRefresh size={14} />
                </Button>
                <Button
                  variant="icon-only"
                  title="Remove mount"
                  onClick={() => setRemoveTarget(mount)}
                >
                  <TbTrash size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Dialog>
      <DeleteConfirmationDialog
        open={!!removeTarget}
        title="Remove content mount?"
        message={removeTarget ? `Remove ${removeTarget.destination_path} and its synchronized content?` : ''}
        detail="The source repository will not be changed."
        confirmLabel="Remove mount"
        onConfirm={() => void remove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  );
};
