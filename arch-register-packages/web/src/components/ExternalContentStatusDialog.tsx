import type { ExternalContentMount } from '@arch-register/api-types/externalContentContract';
import { Dialog } from '@diagram-craft/app-components/Dialog';

type Props = {
  mount: ExternalContentMount | null;
  open: boolean;
  onClose: () => void;
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : 'Never');

const statusLabel = (mount: ExternalContentMount) => {
  if (mount.status === 'syncing' || mount.source.status === 'syncing') return 'Syncing';
  if (mount.status === 'failed' || mount.source.status === 'failed') return 'Failed';
  if (mount.status === 'succeeded') return 'Succeeded';
  return 'Waiting for initial sync';
};

export const ExternalContentStatusDialog = ({ mount, open, onClose }: Props) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={mount ? `Status: ${mount.destination_path}` : 'Mount status'}
    buttons={[{ label: 'Close', type: 'cancel', onClick: onClose }]}
    width={520}
  >
    {mount && (
      <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
        <div>
          <strong>Status:</strong> {statusLabel(mount)}
        </div>
        <div>
          <strong>Repository:</strong> {mount.source.source_config.url}
        </div>
        <div>
          <strong>Repository path:</strong> {mount.source_path ?? '/'}
        </div>
        <div>
          <strong>Refresh interval:</strong> Every {mount.interval_hours} hour
          {mount.interval_hours === 1 ? '' : 's'}
        </div>
        <div>
          <strong>Last synchronized:</strong> {formatDate(mount.last_synced_at)}
        </div>
        {mount.last_revision && (
          <div>
            <strong>Revision:</strong> <code>{mount.last_revision}</code>
          </div>
        )}
        {mount.last_error && (
          <div style={{ color: 'var(--error, #b42318)' }}>
            <strong>Error:</strong> {mount.last_error}
          </div>
        )}
      </div>
    )}
  </Dialog>
);
