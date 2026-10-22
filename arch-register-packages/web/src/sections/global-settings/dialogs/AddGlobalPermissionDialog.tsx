import { useState } from 'react';
import type { GlobalRole } from '@arch-register/permissions';
import type { UserDetail, UserSummary } from '@arch-register/api-types/authContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { UserDialog } from '../../../components/UserDialog';
import { getUserLabel } from '../../../utils/userLabel';
import { RoleCheckboxList } from './RoleCheckboxList';
import { useRoleDraft } from './useRoleDraft';
import styles from './GlobalPermissionDialogs.module.css';

/** Render only while open; state is initialised on mount. */
export const AddGlobalPermissionDialog = ({
  users,
  canCreateUsers,
  isSaving,
  onClose,
  onCreated,
  onSave
}: {
  users: UserSummary[];
  canCreateUsers: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCreated: (userId: string) => void;
  onSave: (userId: string, roles: GlobalRole[]) => Promise<void>;
}) => {
  const [pickedUserId, setPickedUserId] = useState('');
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const draft = useRoleDraft([]);

  const selectedUserId = users.some(u => u.id === pickedUserId)
    ? pickedUserId
    : (users[0]?.id ?? '');

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title="Add user to global roles"
      footerLeft={
        canCreateUsers ? (
          <Button variant="secondary" onClick={() => setCreateUserDialogOpen(true)}>
            Create new user
          </Button>
        ) : undefined
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose, disabled: isSaving },
        {
          label: isSaving ? 'Saving…' : 'Add user',
          type: 'default',
          onClick: () => void onSave(selectedUserId, draft.roles),
          disabled: !selectedUserId || draft.roles.length === 0 || isSaving
        }
      ]}
    >
      <div className={styles.body}>
        {users.length === 0 ? (
          <div className={styles.emptyInline}>
            All existing users already have a global role assignment.
          </div>
        ) : (
          <>
            <FormElement label="User" hint="Select an existing user and assign their global roles.">
              <Select.Root
                value={selectedUserId}
                onChange={value => setPickedUserId(value ?? '')}
                style={{ width: '100%' }}
              >
                {users.map(candidate => (
                  <Select.Item key={candidate.id} value={candidate.id}>
                    {getUserLabel(candidate)}
                    {candidate.email ? ` (${candidate.email})` : ''}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
            <RoleCheckboxList roles={draft.roles} onToggle={draft.toggle} disabled={isSaving} />
          </>
        )}
        <UserDialog
          open={createUserDialogOpen}
          onClose={() => setCreateUserDialogOpen(false)}
          onCreated={(createdUser: UserDetail) => {
            setCreateUserDialogOpen(false);
            onCreated(createdUser.id);
          }}
        />
      </div>
    </Dialog>
  );
};
