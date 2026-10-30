import { SaveBarButtons } from '../SaveBarButtons';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Banner } from '../../../components/Banner';
import { MutationError } from '../MutationError';
import { SettingsBlock, SettingsBlockField } from '../SettingsBlock';
import { LoadingState } from '../../../components/LoadingState';
import { useApplications } from '../../../hooks/useApplications';
import { PrincipalPicker } from '../../../components/PrincipalPicker';
import type {
  ApplicationAccessMode,
  ApplicationAccessPolicyInput,
  WorkspaceApplicationId
} from '@arch-register/api-types/workspaceConfigContract';
import {
  useApplicationAccessConfiguration,
  useUpdateApplicationAccessPolicy
} from '../../../hooks/useWorkspaceConfig';

type ManagedApplicationId = Exclude<WorkspaceApplicationId, 'home'>;

type AccessDraft = {
  allMembers: boolean;
  user_ids: string[];
  team_ids: string[];
};

const toDraft = (
  policy: { mode: ApplicationAccessMode; user_ids: string[]; team_ids: string[] } | undefined
): AccessDraft => ({
  allMembers: policy?.mode === 'all_members',
  user_ids: policy?.user_ids ?? [],
  team_ids: policy?.team_ids ?? []
});

/**
 * The access / visibility policy for a single managed application: all workspace members, or a
 * selected set of teams and people, may use it — independent of workspace roles. Extracted from the
 * former `ApplicationAccessSubSection` so it can live as a tab on the Applications & Capabilities
 * screen.
 */
export const ApplicationAccessCard = ({
  workspaceSlug,
  applicationId,
  onActionsChange
}: {
  workspaceSlug: string;
  applicationId: ManagedApplicationId;
  /** Hoists Cancel / Save changes to the screen header. */
  onActionsChange: (actions: ReactNode | undefined) => void;
}) => {
  const {
    data: configuration,
    isLoading,
    error
  } = useApplicationAccessConfiguration(workspaceSlug);
  const updatePolicy = useUpdateApplicationAccessPolicy(workspaceSlug);
  const [draft, setDraftState] = useState<AccessDraft>(toDraft(undefined));

  const { data: applications } = useApplications(workspaceSlug);
  const app = useMemo(
    () => applications?.find(candidate => candidate.key === applicationId),
    [applications, applicationId]
  );

  const policy = useMemo(
    () => configuration?.policies.find(item => item.application_id === applicationId),
    [configuration?.policies, applicationId]
  );

  useEffect(() => {
    if (!configuration) return;
    setDraftState(toDraft(policy));
  }, [configuration, policy]);

  const setDraft = (next: Partial<AccessDraft>) =>
    setDraftState(current => ({ ...current, ...next }));

  const savedDraft = useMemo(() => toDraft(policy), [policy]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const save = useCallback(async () => {
    const next: ApplicationAccessPolicyInput = draft.allMembers
      ? { mode: 'all_members', user_ids: [], team_ids: [] }
      : { mode: 'selected', user_ids: draft.user_ids, team_ids: draft.team_ids };
    await updatePolicy.mutateAsync({ applicationId, policy: next });
  }, [applicationId, draft, updatePolicy.mutateAsync]);

  const resetDraft = useCallback(() => setDraftState(savedDraft), [savedDraft]);

  const busy = updatePolicy.isPending;

  useEffect(() => {
    onActionsChange(
      <SaveBarButtons dirty={dirty} pending={busy} onCancel={resetDraft} onSave={save} />
    );
  }, [dirty, busy, resetDraft, save, onActionsChange]);

  useEffect(() => () => onActionsChange(undefined), [onActionsChange]);

  if (isLoading) return <LoadingState text="Loading application access…" size="sm" />;
  if (error) return <Banner variant="error">Failed to load application access settings.</Banner>;
  if (!configuration || !app) return null;

  const saving = busy;

  return (
    <>
      <MutationError error={updatePolicy.error} />
      <SettingsBlock
        title="Access"
        description={`Controls who can open ${app.name}, independent of workspace roles and entity permissions. Global administrators and workspace role managers always keep access.`}
      >
        <SettingsBlockField label="All workspace members">
          <Checkbox
            value={draft.allMembers}
            disabled={saving}
            onChange={value => setDraft({ allMembers: !!value })}
          />
        </SettingsBlockField>

        {!draft.allMembers && (
          <>
            <SettingsBlockField
              label="Teams"
              hint="Team membership grants access to every member of the team."
              align="top"
            >
              <PrincipalPicker
                workspaceSlug={workspaceSlug}
                kind="team"
                values={draft.team_ids}
                onChange={team_ids => setDraft({ team_ids })}
              />
            </SettingsBlockField>
            <SettingsBlockField
              label="People"
              hint="Selections are additive with team grants."
              align="top"
            >
              <PrincipalPicker
                workspaceSlug={workspaceSlug}
                kind="user"
                values={draft.user_ids}
                onChange={user_ids => setDraft({ user_ids })}
              />
            </SettingsBlockField>
          </>
        )}
      </SettingsBlock>
    </>
  );
};
