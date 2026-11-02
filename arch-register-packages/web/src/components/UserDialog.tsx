import { useEffect, useState } from 'react';
import type { UserDetail, UserSummary } from '@arch-register/api-types/authContract';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Banner } from './Banner';
import { emptyUserFormValues, normalizeEmail, UserFormFields, type UserFormValues } from './UserFormFields';
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

  const [values, setValues] = useState<UserFormValues>(emptyUserFormValues);
  const { userId, email, displayName, password, isActive, color } = values;
  const resetCreateUser = createUser.reset;
  const resetUpdateUser = updateUser.reset;

  useEffect(() => {
    if (!open) return;
    setValues({
      userId: user?.user_id ?? '',
      email: user?.email ?? '',
      displayName: user?.display_name ?? '',
      password: '',
      isActive: user?.is_active ?? true,
      color: user?.color ?? null
    });
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

        <UserFormFields
          values={values}
          onChange={patch => setValues(prev => ({ ...prev, ...patch }))}
          isEditing={isEditing}
          isSaving={isSaving}
          isCurrentUser={isCurrentUser}
          authProvider={user?.auth_provider ?? 'local'}
        />
      </div>
    </Dialog>
  );
};
