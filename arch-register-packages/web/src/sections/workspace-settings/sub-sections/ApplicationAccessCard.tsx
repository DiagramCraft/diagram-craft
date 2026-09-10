import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Banner } from '../../../components/Banner';
import { LoadingState } from '../../../components/LoadingState';
import { APP_DEFINITIONS } from '../../../shell/appShellRegistry';
import { PrincipalPicker } from '../../../components/PrincipalPicker';
import type {
  ApplicationAccessMode,
  ApplicationAccessPolicyInput,
  WorkspaceApplicationId
} from '@arch-register/api-types/workspaceConfigContract';
import {
  useApplicationAccessConfiguration,
  useUpdateApplicationAccessPolicy,
  useWorkspaceCapabilityConfigurations
} from '../../../hooks/useWorkspaceConfig';
import styles from './ApplicationAccessSubSection.module.css';

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
  /** Hoists Cancel / Save changes to the screen header, matching the binding editor. */
  onActionsChange: (actions: ReactNode | undefined) => void;
}) => {
  const {
    data: configuration,
    isLoading,
    error
  } = useApplicationAccessConfiguration(workspaceSlug);
  const { data: capabilityConfigurations = [] } =
    useWorkspaceCapabilityConfigurations(workspaceSlug);
  const updatePolicy = useUpdateApplicationAccessPolicy(workspaceSlug);
  const [draft, setDraftState] = useState<AccessDraft>(toDraft(undefined));

  const app = useMemo(
    () => APP_DEFINITIONS.find(candidate => candidate.applicationId === applicationId),
    [applicationId]
  );

  const policy = useMemo(
    () => configuration?.policies.find(item => item.application_id === applicationId),
    [configuration?.policies, applicationId]
  );

  useEffect(() => {
    if (!configuration) return;
    setDraftState(toDraft(policy));
  }, [configuration, policy]);

  const setDraft = (next: Partial<AccessDraft>) => setDraftState(current => ({ ...current, ...next }));

  const savedDraft = useMemo(() => toDraft(policy), [policy]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const installed = useMemo(() => {
    const enablement = app?.enablement;
    if (!enablement || enablement === 'always') return true;
    return capabilityConfigurations.some(
      item => item.type === enablement.capabilityType && item.valid
    );
  }, [app, capabilityConfigurations]);

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
      <>
        <Button disabled={!dirty || busy} onClick={resetDraft}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
          {updatePolicy.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </>
    );
  }, [dirty, busy, resetDraft, save, updatePolicy.isPending, onActionsChange]);

  useEffect(() => () => onActionsChange(undefined), [onActionsChange]);

  if (isLoading) return <LoadingState text="Loading application access…" size="sm" />;
  if (error) return <Banner variant="error">Failed to load application access settings.</Banner>;
  if (!configuration || !app) return null;

  const saving = busy;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', paddingTop: '1rem' }}
    >
      {updatePolicy.error && (
        <Banner variant="error">
          {updatePolicy.error instanceof Error
            ? updatePolicy.error.message
            : 'Failed to save application access.'}
        </Banner>
      )}

      <p
        style={{
          margin: 0,
          fontSize: '11.5px',
          color: 'var(--base-fg-more-dim)',
          textWrap: 'pretty'
        }}
      >
        Controls who can open {app.name}, independent of workspace roles and entity permissions.
        Global administrators and workspace role managers always keep access.
      </p>

      <div className={styles.controls}>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '11px' }}
        >
          <Checkbox
            value={draft.allMembers}
            disabled={saving}
            onChange={value => setDraft({ allMembers: !!value })}
          />
          All workspace members
        </label>

        {!draft.allMembers && (
          <div className={styles.targetGrid}>
            <FormElement
              label="Teams"
              hint="Team membership grants access to every member of the team."
            >
              <PrincipalPicker
                workspaceSlug={workspaceSlug}
                kind="team"
                values={draft.team_ids}
                onChange={team_ids => setDraft({ team_ids })}
              />
            </FormElement>
            <FormElement label="People" hint="Selections are additive with team grants.">
              <PrincipalPicker
                workspaceSlug={workspaceSlug}
                kind="user"
                values={draft.user_ids}
                onChange={user_ids => setDraft({ user_ids })}
              />
            </FormElement>
          </div>
        )}
      </div>

      {!installed && (
        <span className={styles.hint}>
          Configure the app&apos;s capability binding before it can appear in the switcher.
        </span>
      )}
    </div>
  );
};
