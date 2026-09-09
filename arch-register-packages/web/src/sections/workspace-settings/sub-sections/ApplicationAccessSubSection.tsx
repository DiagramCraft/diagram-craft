import { useEffect, useMemo, useState } from 'react';
import { TbApps, TbCheck, TbLock, TbUsers } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Banner } from '../../../components/Banner';
import { LoadingState } from '../../../components/LoadingState';
import { APP_DEFINITIONS } from '../../../shell/appShellRegistry';
import type {
  ApplicationAccessMode,
  ApplicationAccessPolicyInput,
  WorkspaceApplicationId
} from '@arch-register/api-types/workspaceConfigContract';
import {
  useApplicationAccessConfiguration,
  useResetApplicationAccessPolicy,
  useUpdateApplicationAccessPolicy,
  useWorkspaceCapabilityConfigurations
} from '../../../hooks/useWorkspaceConfig';
import styles from './ApplicationAccessSubSection.module.css';

type DraftMode = 'none' | ApplicationAccessMode;

type AccessDraft = {
  mode: DraftMode;
  user_ids: string[];
  team_ids: string[];
};

type ManagedApplicationId = Exclude<WorkspaceApplicationId, 'home'>;

const managedApplications = APP_DEFINITIONS.filter(app => app.applicationId !== 'home');

const toDraft = (
  policy: { mode: ApplicationAccessMode; user_ids: string[]; team_ids: string[] } | undefined
): AccessDraft => ({
  mode: policy?.mode ?? 'none',
  user_ids: policy?.user_ids ?? [],
  team_ids: policy?.team_ids ?? []
});

const selectedValues = (event: React.ChangeEvent<HTMLSelectElement>) =>
  Array.from(event.currentTarget.selectedOptions, option => option.value);

export const ApplicationAccessSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const {
    data: configuration,
    isLoading,
    error
  } = useApplicationAccessConfiguration(workspaceSlug);
  const { data: capabilityConfigurations = [] } =
    useWorkspaceCapabilityConfigurations(workspaceSlug);
  const updatePolicy = useUpdateApplicationAccessPolicy(workspaceSlug);
  const resetPolicy = useResetApplicationAccessPolicy(workspaceSlug);
  const [drafts, setDrafts] = useState<Record<string, AccessDraft>>({});

  const policiesByApplication = useMemo(
    () => new Map(configuration?.policies.map(policy => [policy.application_id, policy])),
    [configuration?.policies]
  );

  useEffect(() => {
    if (!configuration) return;
    setDrafts(
      Object.fromEntries(
        managedApplications.map(app => [
          app.applicationId,
          toDraft(policiesByApplication.get(app.applicationId))
        ])
      )
    );
  }, [configuration, policiesByApplication]);

  const setDraft = (applicationId: ManagedApplicationId, next: Partial<AccessDraft>) => {
    setDrafts(current => ({
      ...current,
      [applicationId]: {
        ...(current[applicationId] ?? toDraft(undefined)),
        ...next
      }
    }));
  };

  const isInstalled = (applicationId: ManagedApplicationId) => {
    const app = managedApplications.find(candidate => candidate.applicationId === applicationId);
    const enablement = app?.enablement;
    if (!enablement || enablement === 'always') return true;
    return capabilityConfigurations.some(
      configuration => configuration.type === enablement.capabilityType && configuration.valid
    );
  };

  const save = async (applicationId: ManagedApplicationId) => {
    const draft = drafts[applicationId] ?? toDraft(undefined);
    const policy: ApplicationAccessPolicyInput = {
      mode: draft.mode === 'all_members' ? 'all_members' : 'selected',
      user_ids: draft.mode === 'selected' ? draft.user_ids : [],
      team_ids: draft.mode === 'selected' ? draft.team_ids : []
    };
    await updatePolicy.mutateAsync({ applicationId, policy });
  };

  const reset = async (applicationId: ManagedApplicationId) => {
    await resetPolicy.mutateAsync(applicationId);
    setDraft(applicationId, { mode: 'none', user_ids: [], team_ids: [] });
  };

  if (isLoading) return <LoadingState text="Loading application access…" size="sm" />;
  if (error) return <Banner variant="error">Failed to load application access settings.</Banner>;
  if (!configuration) return null;

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        <TbLock size={16} />
        <div>
          <div className={styles.introTitle}>Control application access</div>
          <div className={styles.introText}>
            Application access is separate from workspace roles. Global administrators and workspace
            role managers always retain access. Ordinary members need workspace view access and an
            explicit policy grant.
          </div>
        </div>
      </div>

      {(updatePolicy.error ?? resetPolicy.error) && (
        <Banner variant="error">
          {(updatePolicy.error ?? resetPolicy.error) instanceof Error
            ? (updatePolicy.error ?? resetPolicy.error)!.message
            : 'Failed to save application access.'}
        </Banner>
      )}

      <div className={styles.cards}>
        {managedApplications.map(app => {
          const applicationId = app.applicationId as ManagedApplicationId;
          const draft = drafts[applicationId] ?? toDraft(policiesByApplication.get(applicationId));
          const installed = isInstalled(applicationId);
          const saving = updatePolicy.isPending || resetPolicy.isPending;
          const hasPolicy = policiesByApplication.has(applicationId);

          return (
            <section className={styles.card} key={applicationId}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <span className={styles.appIcon}>
                    <TbApps size={15} />
                  </span>
                  <div>
                    <h3>{app.name}</h3>
                    <p>{app.description}</p>
                  </div>
                </div>
                <span className={`${styles.status} ${installed ? styles.statusInstalled : ''}`}>
                  {installed ? <TbCheck size={12} /> : null}
                  {installed ? 'Installed' : 'Not installed'}
                </span>
              </div>

              <div className={styles.controls}>
                <label className={styles.field}>
                  <span>Who can use it?</span>
                  <select
                    value={draft.mode}
                    disabled={saving}
                    onChange={event =>
                      setDraft(applicationId, { mode: event.currentTarget.value as DraftMode })
                    }
                  >
                    <option value="none">No members</option>
                    <option value="selected">Selected teams and people</option>
                    <option value="all_members">All workspace members</option>
                  </select>
                </label>

                {draft.mode === 'selected' && (
                  <div className={styles.targetGrid}>
                    <label className={styles.field}>
                      <span>
                        <TbUsers size={12} /> Teams
                      </span>
                      <select
                        multiple
                        value={draft.team_ids}
                        disabled={saving}
                        onChange={event =>
                          setDraft(applicationId, { team_ids: selectedValues(event) })
                        }
                      >
                        {configuration.teams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <small>Team membership grants access to every member of the team.</small>
                    </label>
                    <label className={styles.field}>
                      <span>
                        <TbUsers size={12} /> People
                      </span>
                      <select
                        multiple
                        value={draft.user_ids}
                        disabled={saving}
                        onChange={event =>
                          setDraft(applicationId, { user_ids: selectedValues(event) })
                        }
                      >
                        {configuration.members.map(member => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.display_name}
                            {member.email ? ` (${member.email})` : ''}
                          </option>
                        ))}
                      </select>
                      <small>Selections are additive with team grants.</small>
                    </label>
                  </div>
                )}
              </div>

              <div className={styles.actions}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  onClick={() => void save(applicationId)}
                >
                  Save access
                </Button>
                {hasPolicy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => void reset(applicationId)}
                  >
                    Reset to administrator-only
                  </Button>
                )}
                {!installed && (
                  <span className={styles.hint}>
                    Configure the app's capability binding before it can appear in the switcher.
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
