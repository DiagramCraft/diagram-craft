import { useEffect, useState } from 'react';
import { TbCopy, TbKey, TbTrash } from 'react-icons/tb';
import { WORKSPACE_ROLE_CAPABILITIES } from '@arch-register/permissions';
import type {
  WorkspaceApiToken,
  WorkspaceApiTokenCreate
} from '@arch-register/api-types/apiTokenContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Table } from '../../../components/table/Table';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import {
  useWorkspaceApiTokens,
  useCreateWorkspaceApiToken,
  useRevokeWorkspaceApiToken
} from '../../../hooks/useWorkspaceApiTokens';
import { formatDate } from '../../../utils/dateFormat';
import styles from './WorkspaceApiTokensSubSection.module.css';

const EDITOR_CAPABILITIES = [...WORKSPACE_ROLE_CAPABILITIES.editor];

const CAPABILITY_LABELS: Record<string, string> = {
  'ws.view': 'View workspace',
  'ws.manage_views': 'Manage views',
  'proj.create': 'Create projects',
  'proj.edit': 'Edit projects and diagrams',
  'content.view': 'View content',
  'content.edit': 'Edit content',
  'ent.edit': 'Edit entities',
  'ent.propose': 'Propose entity changes',
  comments: 'Comment and discuss',
  export: 'Export data'
};

const toExpiryIso = (value: string) =>
  value === '' ? null : new Date(`${value}T23:59:59.999Z`).toISOString();

const TokenCreateDialog = ({
  open,
  pending,
  error,
  onClose,
  onCreate
}: {
  open: boolean;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  onCreate: (input: WorkspaceApiTokenCreate) => Promise<void>;
}) => {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [capabilities, setCapabilities] = useState(EDITOR_CAPABILITIES);

  useEffect(() => {
    if (!open) return;
    setName('');
    setExpiresAt('');
    setCapabilities(EDITOR_CAPABILITIES);
  }, [open]);

  if (!open) return null;

  const toggleCapability = (capability: (typeof EDITOR_CAPABILITIES)[number]) => {
    setCapabilities(current =>
      current.includes(capability)
        ? current.filter(value => value !== capability)
        : [...current, capability]
    );
  };

  const canCreate = name.trim().length > 0 && capabilities.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create API token"
      sup="Workspace API tokens"
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
            void onCreate({
              name,
              capabilities,
              expires_at: toExpiryIso(expiresAt)
            })
        }
      ]}
    >
      <div className={styles.form}>
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
                <span>{CAPABILITY_LABELS[capability] ?? capability}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <div className={styles.error}>{error.message}</div>}
      </div>
    </Dialog>
  );
};

const SecretDialog = ({ token, onClose }: { token: string | null; onClose: () => void }) => {
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

export const WorkspaceApiTokensSubSection = ({
  workspaceSlug,
  createDialogOpen,
  onCloseCreateDialog
}: {
  workspaceSlug: string;
  createDialogOpen: boolean;
  onCloseCreateDialog: () => void;
}) => {
  const { data: tokens = [], isLoading, error } = useWorkspaceApiTokens(workspaceSlug);
  const createToken = useCreateWorkspaceApiToken(workspaceSlug);
  const revokeToken = useRevokeWorkspaceApiToken(workspaceSlug);
  const [secret, setSecret] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const tokenToRevoke: WorkspaceApiToken | null =
    tokens.find(token => token.id === revokeId) ?? null;

  const handleCreate = async (input: WorkspaceApiTokenCreate) => {
    const created = await createToken.mutateAsync(input);
    onCloseCreateDialog();
    setSecret(created.token);
  };

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        Tokens created here are owned by the workspace itself, not any individual member, so they
        keep working even if the admin who created them leaves. For a personal token tied to your
        own account, use Account Settings instead.
      </div>

      {error ? (
        <div className={styles.error}>Failed to load API tokens: {error.message}</div>
      ) : isLoading ? (
        <LoadingState text="Loading API tokens…" size="sm" />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<TbKey size={20} />}
          title="No API tokens"
          subtitle="Create a token for a CI pipeline or service integration."
          compact
        />
      ) : (
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
                  <Button
                    variant="icon-only"
                    title={`Revoke ${token.name}`}
                    onClick={() => setRevokeId(token.id)}
                  >
                    <TbTrash size={14} />
                  </Button>
                </Table.ActionsCell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <TokenCreateDialog
        open={createDialogOpen}
        pending={createToken.isPending}
        error={createToken.error instanceof Error ? createToken.error : null}
        onClose={onCloseCreateDialog}
        onCreate={handleCreate}
      />
      <SecretDialog token={secret} onClose={() => setSecret(null)} />
      <DeleteConfirmationDialog
        open={tokenToRevoke != null}
        title={`Revoke ${tokenToRevoke?.name ?? 'API token'}?`}
        message="This token will stop working immediately."
        confirmLabel={revokeToken.isPending ? 'Revoking…' : 'Revoke token'}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => {
          if (!revokeId || revokeToken.isPending) return;
          void revokeToken.mutateAsync(revokeId).then(() => setRevokeId(null));
        }}
      />
    </div>
  );
};
