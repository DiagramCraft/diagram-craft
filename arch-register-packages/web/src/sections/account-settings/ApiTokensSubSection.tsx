import { useEffect, useMemo, useState } from 'react';
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
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Table } from '../../components/table/Table';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import {
  useAccountApiTokens,
  useCreateAccountApiToken,
  useRevokeAccountApiToken
} from '../../hooks/useAccountApiTokens';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import styles from './ApiTokensSubSection.module.css';

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

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : 'Never';

const toExpiryIso = (value: string) =>
  value === '' ? null : new Date(`${value}T23:59:59.999Z`).toISOString();

const TokenCreateDialog = ({
  open,
  pending,
  error,
  workspaces,
  onClose,
  onCreate
}: {
  open: boolean;
  pending: boolean;
  error: Error | null;
  workspaces: Workspace[];
  onClose: () => void;
  onCreate: (input: WorkspaceApiTokenCreate & { workspace: string }) => Promise<void>;
}) => {
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [capabilities, setCapabilities] = useState(EDITOR_CAPABILITIES);

  useEffect(() => {
    if (!open) return;
    setName('');
    setWorkspace(workspaces[0]?.url_slug ?? '');
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

  const canCreate = name.trim().length > 0 && workspace !== '' && capabilities.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create API token"
      sup="Account security"
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
              workspace,
              name,
              capabilities,
              expires_at: toExpiryIso(expiresAt)
            })
        }
      ]}
    >
      <div className={styles.form}>
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

type TokenGroup = {
  workspace: Workspace | null;
  tokens: WorkspaceApiToken[];
};

export const ApiTokensSubSection = ({
  createDialogOpen,
  onCloseCreateDialog
}: {
  createDialogOpen: boolean;
  onCloseCreateDialog: () => void;
}) => {
  const {
    data: tokens = [],
    isLoading: isLoadingTokens,
    error: tokenError
  } = useAccountApiTokens();
  const {
    data: workspaces = [],
    isLoading: isLoadingWorkspaces,
    error: workspaceError
  } = useWorkspaces();
  const createToken = useCreateAccountApiToken();
  const revokeToken = useRevokeAccountApiToken();
  const [secret, setSecret] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const workspaceById = useMemo(
    () => new Map(workspaces.map(workspace => [workspace.id, workspace])),
    [workspaces]
  );
  const groups = useMemo(() => {
    const grouped = new Map<string, TokenGroup>();
    for (const token of tokens) {
      const group = grouped.get(token.workspace) ?? {
        workspace: workspaceById.get(token.workspace) ?? null,
        tokens: []
      };
      group.tokens.push(token);
      grouped.set(token.workspace, group);
    }
    return [...grouped.entries()].sort(([, first], [, second]) =>
      (first.workspace?.name ?? first.tokens[0]?.workspace ?? '').localeCompare(
        second.workspace?.name ?? second.tokens[0]?.workspace ?? ''
      )
    );
  }, [tokens, workspaceById]);

  const tokenToRevoke = useMemo(
    () => tokens.find(token => token.id === revokeId) ?? null,
    [revokeId, tokens]
  );

  const handleCreate = async (input: WorkspaceApiTokenCreate & { workspace: string }) => {
    const created = await createToken.mutateAsync(input);
    onCloseCreateDialog();
    setSecret(created.token);
  };

  const error = tokenError ?? workspaceError;

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        API tokens belong to your account and are each limited to one workspace. Treat them like
        passwords and revoke them when no longer needed.
      </div>

      {error ? (
        <div className={styles.error}>Failed to load API tokens: {error.message}</div>
      ) : isLoadingTokens || isLoadingWorkspaces ? (
        <LoadingState text="Loading API tokens…" size="sm" />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<TbKey size={20} />}
          title="No API tokens"
          subtitle="Create a token for a CI pipeline or service integration."
          compact
        />
      ) : (
        groups.map(([workspaceId, group]) => (
          <div className={styles.workspaceGroup} key={workspaceId}>
            <div className={styles.workspaceHead}>
              <div className={styles.workspaceName}>
                {group.workspace?.name ?? 'Unknown workspace'}
              </div>
              <div className={styles.workspaceSlug}>{group.workspace?.url_slug ?? workspaceId}</div>
            </div>
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
                {group.tokens.map(token => (
                  <Table.Row key={token.id}>
                    <Table.NameCell
                      title={token.name}
                      subtitle={`Created ${formatDate(token.created_at)}`}
                      icon={<TbKey size={14} />}
                    />
                    <Table.Cell>{token.capabilities.length} editor capabilities</Table.Cell>
                    <Table.Cell>{formatDate(token.last_used_at)}</Table.Cell>
                    <Table.Cell>
                      {token.expires_at ? formatDate(token.expires_at) : 'Never'}
                    </Table.Cell>
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
          </div>
        ))
      )}

      <TokenCreateDialog
        open={createDialogOpen}
        pending={createToken.isPending}
        error={createToken.error instanceof Error ? createToken.error : null}
        workspaces={workspaces}
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
