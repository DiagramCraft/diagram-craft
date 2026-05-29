import { WORKSPACE_ROLES, type WorkspaceRole } from '@arch-register/permissions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { useWorkspaceMembers, useWorkspaceUsers, useUpdateWorkspaceMemberRole } from '../hooks/useWorkspaceMembers';
import styles from './MembersSection.module.css';

export const MembersSection = ({
  workspaceSlug,
  addDialogOpen,
  onCloseAddDialog,
}: {
  workspaceSlug: string;
  addDialogOpen: boolean;
  onCloseAddDialog: () => void;
}) => {
  const { data: members = [], isLoading, error } = useWorkspaceMembers(workspaceSlug);
  const { data: users = [], isLoading: isLoadingUsers } = useWorkspaceUsers(workspaceSlug, addDialogOpen);
  const updateMemberRole = useUpdateWorkspaceMemberRole(workspaceSlug);

  const memberIds = useMemo(() => new Set(members.map(member => member.user_id)), [members]);
  const availableUsers = useMemo(
    () => users.filter(user => !memberIds.has(user.id)),
    [memberIds, users]
  );

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load workspace members.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.empty}>Loading members…</div>
        ) : members.length === 0 ? (
          <div className={styles.empty}>No members have been added to this workspace.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const roleMeta = WORKSPACE_ROLES.find(role => role.id === member.role);
                return (
                  <tr key={member.user_id}>
                    <td className={styles.userCell}>
                      <div className={styles.userName}>{member.display_name}</div>
                      <div className={styles.userMeta}>{member.email ?? member.user_id}</div>
                    </td>
                    <td>
                      {roleMeta ? (
                        <Chip tone="ghost" dot={roleMeta.tone}>
                          {roleMeta.name}
                        </Chip>
                      ) : (
                        member.role
                      )}
                    </td>
                    <td>{new Date(member.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <AddMemberDialog
        open={addDialogOpen}
        users={availableUsers}
        loading={isLoadingUsers}
        onClose={onCloseAddDialog}
        onSave={async (userId, role) => {
          await updateMemberRole.mutateAsync({ userId, role });
          onCloseAddDialog();
        }}
        isSaving={updateMemberRole.isPending}
      />
    </div>
  );
};

const AddMemberDialog = ({
  open,
  users,
  loading,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  users: Array<{
    id: string;
    email: string | null;
    display_name: string;
    is_active: boolean;
  }>;
  loading: boolean;
  onClose: () => void;
  onSave: (userId: string, role: WorkspaceRole) => Promise<void>;
  isSaving: boolean;
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>('viewer');
  const userRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedUserId(users[0]?.id ?? '');
    setSelectedRole('viewer');
    setTimeout(() => userRef.current?.focus(), 0);
  }, [open, users]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Add workspace member">
      <div className={styles.dialogBody}>
        {loading ? (
          <div className={styles.empty}>Loading users…</div>
        ) : users.length === 0 ? (
          <div className={styles.empty}>All existing users are already members of this workspace.</div>
        ) : (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>User</div>
                <div className={styles.fieldHint}>Choose an existing user to add to this workspace.</div>
              </div>
              <div className={styles.fieldRight}>
                <select
                  ref={userRef}
                  className={styles.select}
                  value={selectedUserId}
                  onChange={event => setSelectedUserId(event.target.value)}
                >
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.display_name || user.id}{user.email ? ` (${user.email})` : ''}{!user.is_active ? ' - inactive' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>Role</div>
                <div className={styles.fieldHint}>Set the workspace role that will be stored on this membership.</div>
              </div>
              <div className={styles.fieldRight}>
                <select
                  className={styles.select}
                  value={selectedRole}
                  onChange={event => setSelectedRole(event.target.value as WorkspaceRole)}
                >
                  {WORKSPACE_ROLES.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btn} onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void onSave(selectedUserId, selectedRole)}
                disabled={!selectedUserId || isSaving}
              >
                {isSaving ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
