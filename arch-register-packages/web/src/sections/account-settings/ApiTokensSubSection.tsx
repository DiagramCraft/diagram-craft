import { useMemo, useState } from 'react';
import { TbKey, TbPlus } from 'react-icons/tb';
import type {
  WorkspaceApiToken,
  WorkspaceApiTokenCreate
} from '@arch-register/api-types/apiTokenContract';
import type { Workspace } from '@arch-register/api-types/workspaceContract';
import { Button } from '@diagram-craft/app-components/Button';
import {
  ApiTokenIntro,
  RevokeTokenDialog,
  SecretDialog,
  TokenCreateDialog,
  TokenTable
} from '../../components/apiTokens/ApiTokenParts';
import {
  useAccountApiTokens,
  useCreateAccountApiToken,
  useRevokeAccountApiToken
} from '../../hooks/useAccountApiTokens';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { SectionActions } from '../workspace-settings/SectionActions';
import { QueryState } from '../workspace-settings/QueryState';
import { SettingsPage } from '../workspace-settings/SettingsBlock';
import styles from './ApiTokensSubSection.module.css';

type TokenGroup = {
  workspaceId: string;
  workspace: Workspace | null;
  tokens: WorkspaceApiToken[];
};

export const ApiTokensSubSection = () => {
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const workspaceById = new Map(workspaces.map(workspace => [workspace.id, workspace]));
    const grouped = new Map<string, TokenGroup>();
    for (const token of tokens) {
      const group = grouped.get(token.workspace) ?? {
        workspaceId: token.workspace,
        workspace: workspaceById.get(token.workspace) ?? null,
        tokens: []
      };
      group.tokens.push(token);
      grouped.set(token.workspace, group);
    }
    return [...grouped.values()].sort((first, second) =>
      (first.workspace?.name ?? first.workspaceId).localeCompare(
        second.workspace?.name ?? second.workspaceId
      )
    );
  }, [tokens, workspaces]);

  const tokenToRevoke = tokens.find(token => token.id === revokeId) ?? null;

  const handleCreate = async (input: WorkspaceApiTokenCreate, workspace: string) => {
    const created = await createToken.mutateAsync({ ...input, workspace });
    setCreateDialogOpen(false);
    setSecret(created.token);
  };

  return (
    <>
      <SectionActions>
        <Button
          variant="primary"
          icon={<TbPlus size={12} />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New API token
        </Button>
      </SectionActions>
      <SettingsPage stacked={false}>
        <ApiTokenIntro>
          API tokens belong to your account and are each limited to one workspace. Treat them like
          passwords and revoke them when no longer needed.
        </ApiTokenIntro>

        <QueryState
          isLoading={isLoadingTokens || isLoadingWorkspaces}
          error={tokenError ?? workspaceError}
          isEmpty={tokens.length === 0}
          subject="API tokens"
          empty={{
            icon: <TbKey size={20} />,
            title: 'No API tokens',
            subtitle: 'Create a token for a CI pipeline or service integration.',
            compact: true
          }}
        >
          {groups.map(group => (
            <div className={styles.workspaceGroup} key={group.workspaceId}>
              <div className={styles.workspaceHead}>
                <div className={styles.workspaceName}>
                  {group.workspace?.name ?? 'Unknown workspace'}
                </div>
                <div className={styles.workspaceSlug}>
                  {group.workspace?.url_slug ?? group.workspaceId}
                </div>
              </div>
              <TokenTable tokens={group.tokens} onRevoke={setRevokeId} />
            </div>
          ))}
        </QueryState>
      </SettingsPage>

      <TokenCreateDialog
        open={createDialogOpen}
        sup="Account security"
        pending={createToken.isPending}
        error={createToken.error instanceof Error ? createToken.error : null}
        workspaces={workspaces}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreate}
      />
      <SecretDialog token={secret} onClose={() => setSecret(null)} />
      <RevokeTokenDialog
        token={tokenToRevoke}
        pending={revokeToken.isPending}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => {
          if (!revokeId || revokeToken.isPending) return;
          void revokeToken.mutateAsync(revokeId).then(() => setRevokeId(null));
        }}
      />
    </>
  );
};
