import { useEffect, useState } from 'react';
import type { UserDetail, UserSummary } from '@arch-register/api-types/authContract';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Banner } from './Banner';
import { ColorPicker } from './ColorPicker';
import {
  useCreateManagedUser,
  useUpdateManagedUser,
  type ManagedUserCreateInput,
  type ManagedUserUpdateInput
} from '../hooks/useUsers';
import styles from './UserDialog.module.css';

export type UserDialogProps = {
  open: boolean;
  user?: UserSummary | null;
  isCurrentUser?: boolean;
  onClose: () => void;
  onCreated?: (user: UserDetail) => void;
  onUpdated?: (user: UserDetail) => void;
};

const normalizeEmail = (email: string) => {
  const trimmed = email.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const UserDialog = ({
  open,
  user = null,
  isCurrentUser = false,
  onClose,
  onCreated,
  onUpdated
}: UserDialogProps) => {
  const createUser = useCreateManagedUser();
  const updateUser = useUpdateManagedUser();
  const isEditing = user != null;
  const isSaving = createUser.isPending || updateUser.isPending;

  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [color, setColor] = useState<string | null>(null);
  const resetCreateUser = createUser.reset;
  const resetUpdateUser = updateUser.reset;

  useEffect(() => {
    if (!open) return;
    setUserId(user?.user_id ?? '');
    setEmail(user?.email ?? '');
    setDisplayName(user?.display_name ?? '');
    setPassword('');
    setIsActive(user?.is_active ?? true);
    setColor(user?.color ?? null);
    resetCreateUser();
    resetUpdateUser();
  }, [open, resetCreateUser, resetUpdateUser, user]);

  const error = createUser.error ?? updateUser.error;
  const normalizedUserId = userId.trim();
  const normalizedDisplayName = displayName.trim();
  const isDirty =
    !isEditing ||
    normalizedDisplayName !== (user?.display_name ?? '') ||
    normalizeEmail(email) !== user?.email ||
    isActive !== user?.is_active ||
    color !== user?.color ||
    password.length > 0;
  const canSave =
    normalizedDisplayName.length > 0 &&
    (isEditing ? true : normalizedUserId.length > 0 && password.length > 0) &&
    isDirty;

  const save = async () => {
    if (!canSave || isSaving) return;

    try {
      if (isEditing && user) {
        const updates: ManagedUserUpdateInput = {
          email: normalizeEmail(email),
          display_name: normalizedDisplayName,
          is_active: isCurrentUser ? true : isActive,
          color
        };
        if (password.length > 0) updates.password = password;
        const updated = await updateUser.mutateAsync({ userId: user.id, updates });
        onUpdated?.(updated);
      } else {
        const input: ManagedUserCreateInput = {
          user_id: normalizedUserId,
          email: normalizeEmail(email),
          display_name: normalizedDisplayName,
          password,
          is_active: isActive,
          color
        };
        const created = await createUser.mutateAsync(input);
        onCreated?.(created);
      }
      onClose();
    } catch {
      // The mutation error is rendered below and remains available for retry.
    }
  };

  if (!open) return null;

  const title = isEditing ? `Edit ${user?.display_name ?? 'user'}` : 'Create user';
  const passwordAvailable = !isEditing || user?.auth_provider === 'local';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={620}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose, disabled: isSaving },
        {
          label: isSaving ? 'Saving…' : isEditing ? 'Save user' : 'Create user',
          type: 'default',
          onClick: () => void save(),
          disabled: !canSave || isSaving
        }
      ]}
    >
      <div className={styles.body}>
        {error && (
          <Banner variant="error">
            {error instanceof Error ? error.message : 'Unable to save user'}
          </Banner>
        )}

        <div className={styles.fieldGrid}>
          <FormElement
            label="Username"
            hint={
              isEditing
                ? 'The username cannot be changed.'
                : 'Used to sign in with local authentication.'
            }
          >
            <TextInput
              value={userId}
              onChange={value => setUserId(value ?? '')}
              placeholder="jane.doe"
              autoFocus={!isEditing}
              disabled={isEditing || isSaving}
            />
          </FormElement>

          <FormElement label="Display name">
            <TextInput
              value={displayName}
              onChange={value => setDisplayName(value ?? '')}
              placeholder="Jane Doe"
              autoFocus={isEditing}
              disabled={isSaving}
            />
          </FormElement>

          <FormElement label="Email" required={false}>
            <TextInput
              value={email}
              onChange={value => setEmail(value ?? '')}
              placeholder="jane@example.com"
              type="email"
              disabled={isSaving}
            />
          </FormElement>

          <FormElement label="Authentication provider">
            <TextInput value={user?.auth_provider ?? 'local'} onChange={() => {}} disabled />
          </FormElement>

          {passwordAvailable ? (
            <FormElement
              label={isEditing ? 'Reset password' : 'Password'}
              required={!isEditing}
              hint={isEditing ? 'Leave blank to keep the current password.' : undefined}
            >
              <TextInput
                value={password}
                onChange={value => setPassword(value ?? '')}
                placeholder={isEditing ? 'Leave blank to keep current password' : 'Password'}
                type="password"
                disabled={isSaving}
              />
            </FormElement>
          ) : (
            <div className={styles.providerNote}>
              This account is managed by OIDC and does not have a local password.
            </div>
          )}
        </div>

        <div className={styles.activeRow}>
          <label>
            <input
              type="checkbox"
              checked={isActive}
              onChange={event => setIsActive(event.target.checked)}
              disabled={isSaving || isCurrentUser}
            />
            <span>Account is active</span>
          </label>
          {isCurrentUser && (
            <span className={styles.hint}>Your own account cannot be deactivated.</span>
          )}
        </div>

        <FormElement label="Avatar color" required={false}>
          <ColorPicker value={color} onChange={setColor} disabled={isSaving} size="small" />
        </FormElement>
      </div>
    </Dialog>
  );
};
