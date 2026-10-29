import { SettingsPage } from '../SettingsBlock';
import { useState } from 'react';
import { SectionActions } from '../SectionActions';
import { TbKey, TbPlus } from 'react-icons/tb';
import type { WorkspaceApiTokenCreate } from '@arch-register/api-types/apiTokenContract';
import { Button } from '@diagram-craft/app-components/Button';
import { QueryState } from '../QueryState';
import {
  ApiTokenIntro,
  RevokeTokenDialog,
  SecretDialog,
  TokenCreateDialog,
  TokenTable
} from '../../../components/apiTokens/ApiTokenParts';
import {
  useWorkspaceApiTokens,
  useCreateWorkspaceApiToken,
  useRevokeWorkspaceApiToken
} from '../../../hooks/useWorkspaceApiTokens';

export const WorkspaceApiTokensSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const onCloseCreateDialog = () => setCreateDialogOpen(false);
  const { data: tokens = [], isLoading, error } = useWorkspaceApiTokens(workspaceSlug);
  const createToken = useCreateWorkspaceApiToken(workspaceSlug);
  const revokeToken = useRevokeWorkspaceApiToken(workspaceSlug);
  const [secret, setSecret] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const tokenToRevoke = tokens.find(token => token.id === revokeId) ?? null;

  const handleCreate = async (input: WorkspaceApiTokenCreate) => {
    const created = await createToken.mutateAsync(input);
    onCloseCreateDialog();
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
          Create token
        </Button>
      </SectionActions>
      <SettingsPage stacked={false}>
        <ApiTokenIntro>
          Tokens created here are owned by the workspace itself, not any individual member, so they
          keep working even if the admin who created them leaves. For a personal token tied to your
          own account, use Account Settings instead.
        </ApiTokenIntro>

        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={tokens.length === 0}
          subject="API tokens"
          empty={{
            icon: <TbKey size={20} />,
            title: 'No API tokens',
            subtitle: 'Create a token for a CI pipeline or service integration.',
            compact: true
          }}
        >
          <TokenTable tokens={tokens} onRevoke={setRevokeId} />
        </QueryState>

        <TokenCreateDialog
          open={createDialogOpen}
          sup="Workspace API tokens"
          pending={createToken.isPending}
          error={createToken.error instanceof Error ? createToken.error : null}
          onClose={onCloseCreateDialog}
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
      </SettingsPage>
    </>
  );
};
