import { useEffect, useState, type ReactNode } from 'react';
import { TbCopy, TbKey, TbTrash } from 'react-icons/tb';
import { WORKSPACE_ROLE_CAPABILITIES } from '@arch-register/permissions';
import type {
  WorkspaceApiToken,
  WorkspaceApiTokenCreate
} from '@arch-register/api-types/apiTokenContract';
import type { Workspace } from '@arch-register/api-types/workspaceContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Table } from '../table/Table';
import { DropdownMenu, type MenuItem } from '../DropdownMenu';
import { MutationError } from '../../sections/workspace-settings/MutationError';
import { formatDate } from '../../utils/dateFormat';
import { getWorkspaceCapabilityLabel } from '../../lib/workspaceCapabilityLabels';
import styles from './ApiTokenParts.module.css';

const EDITOR_CAPABILITIES = [
  ...WORKSPACE_ROLE_CAPABILITIES.editor,
  'ent.external_update' as const,
  'governance.external' as const
];

const toExpiryIso = (value: string) =>
  value === '' ? null : new Date(`${value}T23:59:59.999Z`).toISOString();

export const ApiTokenIntro = ({ children }: { children: ReactNode }) => (
  <div className={styles.intro}>{children}</div>
);

/**
 * Dialog for creating an API token. When `workspaces` is provided a workspace selector is shown
 * and the selected workspace slug is passed to `onCreate`.
 */
export const TokenCreateDialog = ({
  open,
  sup,
  pending,
  error,
  workspaces,
  onClose,
  onCreate
}: {
  open: boolean;
  sup: string;
  pending: boolean;
  error: Error | null;
  workspaces?: Workspace[];
  onClose: () => void;
  onCreate: (input: WorkspaceApiTokenCreate, workspace: string) => Promise<void>;
}) => {
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [capabilities, setCapabilities] = useState(EDITOR_CAPABILITIES);

  useEffect(() => {
    if (!open) return;
    setName('');
    setWorkspace(workspaces?.[0]?.url_slug ?? '');
    setExpiresAt('');
    setCapabilities(EDITOR_CAPABILITIES);
  }, [open, workspaces]);

  if (!open) return null;

  const toggleCapability = (capability: (typeof EDITOR_CAPABILITIES)[number]) => {
    setCapabilities(current =>
      current.includes(capability)
        ? current.filter(value => value !== capability)
        : [...current, capability]
    );
  };

  const canCreate =
    name.trim().length > 0 &&
    (workspaces === undefined || workspace !== '') &&
    capabilities.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create API token"
      sup={sup}
      className={styles.dialog}
      footerLeft={
        <KbdHints
          hints={[
            ['Esc', 'cancel'],
            ['⌘↵', 'create']
          ]}
        />
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: pending ? 'Creating…' : 'Create token',
          type: 'default',
          disabled: pending || !canCreate,
          onClick: () =>
            void onCreate({ name, capabilities, expires_at: toExpiryIso(expiresAt) }, workspace)
        }
      ]}
    >
      <div className={styles.form}>
        {workspaces && (
          <label className={styles.field}>
            <span className={styles.label}>Workspace</span>
            <Select.Root
              value={workspace || undefined}
              onChange={value => setWorkspace(value ?? '')}
              placeholder={workspaces.length === 0 ? 'No workspaces available' : 'Select workspace'}
              style={{ width: '100%' }}
            >
              {workspaces.map(item => (
                <Select.Item key={item.id} value={item.url_slug}>
                  {item.name}
                </Select.Item>
              ))}
            </Select.Root>
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <TextInput value={name} onChange={value => setName(value ?? '')} autoFocus />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Expires</span>
          <DateInput value={expiresAt} onChange={value => setExpiresAt(value ?? '')} />
          <span className={styles.hint}>Leave empty to use the one-year maximum lifetime.</span>
        </label>

        <div className={styles.capabilityField}>
          <div className={styles.label}>Editor capabilities</div>
          <div className={styles.capabilityGrid}>
            {EDITOR_CAPABILITIES.map(capability => (
              <label className={styles.capability} key={capability}>
                <Checkbox
                  value={capabilities.includes(capability)}
                  onChange={() => toggleCapability(capability)}
                />
                <span>{getWorkspaceCapabilityLabel(capability)}</span>
              </label>
            ))}
          </div>
        </div>
        <MutationError error={error} />
      </div>
    </Dialog>
  );
};

export const SecretDialog = ({ token, onClose }: { token: string | null; onClose: () => void }) => {
  if (!token) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title="API token created"
      sup="Copy this secret now"
      sub="For security, the complete token will not be shown again."
      buttons={[{ label: 'Done', type: 'default', onClick: onClose }]}
    >
      <div className={styles.secretBox}>
        <code>{token}</code>
        <Button
          variant="secondary"
          icon={<TbCopy size={13} />}
          onClick={() => void navigator.clipboard?.writeText(token)}
        >
          Copy
        </Button>
      </div>
    </Dialog>
  );
};

export const TokenTable = ({
  tokens,
  onRevoke
}: {
  tokens: WorkspaceApiToken[];
  onRevoke: (id: string) => void;
}) => (
  <Table.Root>
    <Table.Head>
      <Table.Row>
        <Table.HeaderCell>Token</Table.HeaderCell>
        <Table.HeaderCell>Capabilities</Table.HeaderCell>
        <Table.HeaderCell>Last used</Table.HeaderCell>
        <Table.HeaderCell>Expires</Table.HeaderCell>
        <Table.HeaderCell />
      </Table.Row>
    </Table.Head>
    <Table.Body>
      {tokens.map(token => (
        <Table.Row key={token.id}>
          <Table.NameCell
            title={token.name}
            subtitle={`Created ${formatDate(token.created_at, 'Never')}`}
            icon={<TbKey size={14} />}
          />
          <Table.Cell>{token.capabilities.length} editor capabilities</Table.Cell>
          <Table.Cell>{formatDate(token.last_used_at, 'Never')}</Table.Cell>
          <Table.Cell>{token.expires_at ? formatDate(token.expires_at) : 'Never'}</Table.Cell>
          <Table.ActionsCell>
            <DropdownMenu
              trigger={<Table.DotsButton aria-label={`Actions for ${token.name}`} />}
              items={
                [
                  {
                    label: 'Revoke token',
                    icon: <TbTrash size={14} />,
                    danger: true,
                    onClick: () => onRevoke(token.id)
                  }
                ] satisfies MenuItem[]
              }
            />
          </Table.ActionsCell>
        </Table.Row>
      ))}
    </Table.Body>
  </Table.Root>
);

export const RevokeTokenDialog = ({
  token,
  pending,
  onCancel,
  onConfirm
}: {
  token: WorkspaceApiToken | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <DeleteConfirmationDialog
    open={token != null}
    title={`Revoke ${token?.name ?? 'API token'}?`}
    message="This token will stop working immediately."
    confirmLabel={pending ? 'Revoking…' : 'Revoke token'}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);
