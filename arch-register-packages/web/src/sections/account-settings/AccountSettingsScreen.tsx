import { useEffect, useState } from 'react';
import styles from '../workspace-settings/sub-sections/GeneralSubSection.module.css';
import screenStyles from '../workspace-settings/WorkspaceSettingsScreen.module.css';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbCheck, TbPlus } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { useAuth } from '../../auth/AuthContext';
import { ColorPicker } from '../../components/ColorPicker';
import { MemberAvatar } from '../../components/MemberAvatar';
import { useUpdateUser } from '../../hooks/useUsers';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { ApiTokensSubSection } from './ApiTokensSubSection';
import { NotificationPreferencesSubSection } from './NotificationPreferencesSubSection';

const SECTION_META: Record<string, { title: string; sub: string }> = {
  profile: {
    title: 'Profile',
    sub: 'Review the account details associated with your current sign-in.'
  },
  appearance: {
    title: 'Appearance',
    sub: 'Customize how your account is represented throughout the workspace.'
  },
  notifications: {
    title: 'Notifications',
    sub: 'Choose which notification types deliver to your in-app inbox.'
  },
  'api-tokens': {
    title: 'API tokens',
    sub: 'Manage the workspace-scoped tokens created by your account.'
  }
};

const routeApi = getRouteApi('/authenticated/$workspaceSlug/account/$section');

export const AccountSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const params = routeApi.useParams();
  const { user, reloadUser } = useAuth();
  const ctx = useWorkspaceContext();
  const workspaceSlug = ctx.workspaceSlug;
  const updateUser = useUpdateUser();

  const [selectedColor, setSelectedColor] = useState<string | null>(user?.color ?? null);
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiTokenAddDialogOpen, setApiTokenAddDialogOpen] = useState(false);

  const section =
    params.section === 'appearance'
      ? 'appearance'
      : params.section === 'notifications'
        ? 'notifications'
        : params.section === 'api-tokens'
          ? 'api-tokens'
          : 'profile';

  useEffect(() => {
    if (user) {
      setSelectedColor(user.color ?? null);
      setDisplayName(user.display_name);
    }
  }, [user]);

  if (!user) return null;

  const meta = SECTION_META[section] ?? SECTION_META['profile']!;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateUser.mutateAsync({
        userId: user.id,
        updates: {
          color: selectedColor,
          display_name: displayName.trim() || user.display_name
        }
      });

      await reloadUser();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = selectedColor !== user.color || displayName.trim() !== user.display_name;
  const sectionButton =
    section === 'api-tokens' ? (
      <Button
        variant="primary"
        icon={<TbPlus size={12} />}
        onClick={() => setApiTokenAddDialogOpen(true)}
      >
        New API token
      </Button>
    ) : undefined;

  return (
    <div className={screenStyles.screen}>
      <div className={screenStyles.head}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
            },
            { label: 'Account settings' }
          ]}
          title={meta.title}
          description={meta.sub}
          buttons={sectionButton}
        />
      </div>

      {section === 'api-tokens' ? (
        <ApiTokensSubSection
          createDialogOpen={apiTokenAddDialogOpen}
          onCloseCreateDialog={() => setApiTokenAddDialogOpen(false)}
        />
      ) : section === 'notifications' ? (
        <NotificationPreferencesSubSection />
      ) : (
        <div className={styles.blockList}>
          {section === 'profile' && (
            <>
              <div className={styles.sectionActions}>
                <Button
                  onClick={() => setDisplayName(user.display_name)}
                  disabled={!hasChanges || isSaving}
                >
                  Reset
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={!hasChanges || isSaving}>
                  {isSaving ? (
                    'Saving...'
                  ) : saveSuccess ? (
                    <>
                      <TbCheck size={14} /> Saved
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>Profile</div>
                  <div className={styles.sectionSub}>
                    Basic account details for your current user.
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  <div className={styles.field}>
                    <div className={styles.fieldLeft}>
                      <div className={styles.fieldLabel}>Display Name</div>
                      <div className={styles.fieldHint}>
                        Your name as it appears throughout the application.
                      </div>
                    </div>
                    <div className={styles.fieldRight}>
                      <TextInput
                        aria-label="Display name"
                        value={displayName}
                        onChange={value => setDisplayName(value ?? '')}
                        placeholder="Enter display name"
                        style={{ maxWidth: 340 }}
                      />
                    </div>
                  </div>

                  {user.email && (
                    <div className={styles.field}>
                      <div className={styles.fieldLeft}>
                        <div className={styles.fieldLabel}>Email</div>
                      </div>
                      <div className={styles.fieldRight}>
                        <div>{user.email}</div>
                      </div>
                    </div>
                  )}

                  <div className={styles.field}>
                    <div className={styles.fieldLeft}>
                      <div className={styles.fieldLabel}>Authentication Provider</div>
                    </div>
                    <div className={styles.fieldRight}>
                      <div>{user.auth_provider === 'local' ? 'Local' : 'OIDC'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {section === 'appearance' && (
            <>
              <div className={styles.sectionActions}>
                <Button
                  onClick={() => setSelectedColor(user.color)}
                  disabled={!hasChanges || isSaving}
                >
                  Reset
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={!hasChanges || isSaving}>
                  {isSaving ? (
                    'Saving...'
                  ) : saveSuccess ? (
                    <>
                      <TbCheck size={14} /> Saved
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>Avatar Color</div>
                  <div className={styles.sectionSub}>
                    Choose a color for your avatar that appears throughout the application
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  <div className={styles.field}>
                    <div className={styles.fieldLeft}>
                      <div className={styles.fieldLabel}>Preview</div>
                      <div className={styles.fieldHint}>
                        See how your avatar will appear in lists and assignments.
                      </div>
                    </div>
                    <div className={styles.fieldRight}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div data-testid="account-avatar-preview">
                          <MemberAvatar
                            name={user.display_name}
                            email={user.email}
                            userId={user.id}
                            color={selectedColor}
                            size={48}
                          />
                        </div>
                        <div>
                          <div
                            style={{ fontSize: '14px', fontWeight: 500, color: 'var(--base-fg)' }}
                          >
                            {user.display_name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--base-fg-more-dim)' }}>
                            {user.email ?? 'No email'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLeft}>
                      <div className={styles.fieldLabel}>Color</div>
                      <div className={styles.fieldHint}>
                        Pick a preset or clear it to fall back to the generated avatar style.
                      </div>
                    </div>
                    <div className={styles.fieldRight}>
                      <ColorPicker value={selectedColor} onChange={setSelectedColor} size="small" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
