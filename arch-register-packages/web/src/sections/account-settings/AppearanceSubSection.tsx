import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ColorPicker } from '../../components/ColorPicker';
import { MemberAvatar } from '../../components/MemberAvatar';
import { useUpdateUser } from '../../hooks/useUsers';
import { MutationError } from '../workspace-settings/MutationError';
import { SaveBarButtons } from '../workspace-settings/SaveBarButtons';
import { SectionActions } from '../workspace-settings/SectionActions';
import {
  SettingsBlock,
  SettingsBlockField,
  SettingsBlockList
} from '../workspace-settings/SettingsBlock';

export const AppearanceSubSection = () => {
  const { user, reloadUser } = useAuth();
  const updateUser = useUpdateUser();
  const [color, setColor] = useState<string | null>(user?.color ?? null);

  if (!user) return null;

  const dirty = color !== user.color;

  const handleSave = async () => {
    try {
      await updateUser.mutateAsync({ userId: user.id, updates: { color } });
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
          onCancel={() => setColor(user.color)}
          onSave={handleSave}
        />
      </SectionActions>
      <SettingsBlockList>
        <MutationError error={updateUser.error} />
        <SettingsBlock
          title="Avatar Color"
          description="Choose a color for your avatar that appears throughout the application"
        >
          <SettingsBlockField
            label="Preview"
            hint="See how your avatar will appear in lists and assignments."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div data-testid="account-avatar-preview">
                <MemberAvatar
                  name={user.display_name}
                  email={user.email}
                  userId={user.id}
                  color={color}
                  size={48}
                />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--base-fg)' }}>
                  {user.display_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--base-fg-more-dim)' }}>
                  {user.email ?? 'No email'}
                </div>
              </div>
            </div>
          </SettingsBlockField>

          <SettingsBlockField
            label="Color"
            hint="Pick a preset or clear it to fall back to the generated avatar style."
          >
            <ColorPicker value={color} onChange={setColor} size="small" />
          </SettingsBlockField>
        </SettingsBlock>
      </SettingsBlockList>
    </>
  );
};
