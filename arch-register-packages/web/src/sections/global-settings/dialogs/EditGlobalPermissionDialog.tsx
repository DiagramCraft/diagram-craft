import type { GlobalRole } from '@arch-register/permissions';
import type { UserSummary } from '@arch-register/api-types/authContract';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { getUserLabel } from '../../../utils/userLabel';
import { RoleCheckboxList } from './RoleCheckboxList';
import { useRoleDraft } from './useRoleDraft';
import styles from './GlobalPermissionDialogs.module.css';

/** Mount with `key={user.id}` so the draft resets when a different user is edited. */
export const EditGlobalPermissionDialog = ({
  user,
  assignedRoles,
  isSaving,
  onClose,
  onSave
}: {
  user: UserSummary;
  assignedRoles: GlobalRole[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (roles: GlobalRole[]) => Promise<void>;
}) => {
  const draft = useRoleDraft(assignedRoles);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={`Edit global permission for ${getUserLabel(user)}`}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose, disabled: isSaving },
        {
          label: isSaving ? 'Saving…' : 'Save roles',
          type: 'default',
          onClick: () => void onSave(draft.roles),
          disabled: !draft.isDirty || isSaving
        }
      ]}
    >
      <div className={styles.body}>
        <div className={styles.meta}>{user.email ?? user.id}</div>
        <RoleCheckboxList roles={draft.roles} onToggle={draft.toggle} disabled={isSaving} />
      </div>
    </Dialog>
  );
};
