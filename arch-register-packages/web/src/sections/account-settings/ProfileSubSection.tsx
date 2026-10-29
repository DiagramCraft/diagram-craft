import { useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useAuth } from '../../auth/AuthContext';
import { useUpdateUser } from '../../hooks/useUsers';
import { MutationError } from '../workspace-settings/MutationError';
import { SaveBarButtons } from '../workspace-settings/SaveBarButtons';
import { SectionActions } from '../workspace-settings/SectionActions';
import {
  SettingsBlock,
  SettingsBlockField,
  SettingsBlockList
} from '../workspace-settings/SettingsBlock';

export const ProfileSubSection = () => {
  const { user, reloadUser } = useAuth();
  const updateUser = useUpdateUser();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');

  if (!user) return null;

  const trimmed = displayName.trim();
  const dirty = trimmed !== user.display_name;

  const handleSave = async () => {
    try {
      await updateUser.mutateAsync({
        userId: user.id,
        updates: { display_name: trimmed === '' ? user.display_name : trimmed }
      });
      await reloadUser();
    } catch {
      // The error is surfaced through the mutation state
    }
  };

  return (
    <>
      <SectionActions>
        <SaveBarButtons
          dirty={dirty}
          pending={updateUser.isPending}
          onCancel={() => setDisplayName(user.display_name)}
          onSave={handleSave}
        />
      </SectionActions>
      <SettingsBlockList>
        <MutationError error={updateUser.error} />
        <SettingsBlock title="Profile" description="Basic account details for your current user.">
          <SettingsBlockField
            label="Display Name"
            hint="Your name as it appears throughout the application."
          >
            <TextInput
              aria-label="Display name"
              value={displayName}
              onChange={value => setDisplayName(value ?? '')}
              placeholder="Enter display name"
              style={{ maxWidth: 340 }}
            />
          </SettingsBlockField>

          {user.email && (
            <SettingsBlockField label="Email">
              <div>{user.email}</div>
            </SettingsBlockField>
          )}

          <SettingsBlockField label="Authentication Provider">
            <div>{user.auth_provider === 'local' ? 'Local' : 'OIDC'}</div>
          </SettingsBlockField>
        </SettingsBlock>
      </SettingsBlockList>
    </>
  );
};
