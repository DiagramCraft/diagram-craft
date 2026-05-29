import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { GLOBAL_ROLES, type GlobalRole } from '@arch-register/permissions';
import { useAuth } from '../auth/AuthContext';
import { fetchUserGlobalRoles, type AuthUserInfo } from '../api';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { useAuthUsers, useUpdateUserGlobalRoles, globalRolesKeys } from '../hooks/useGlobalRoles';
import styles from './GlobalPermissionsSection.module.css';

const sameRoles = (left: GlobalRole[], right: GlobalRole[]) => {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((role, index) => role === sortedRight[index]);
};

const getUserLabel = (user: AuthUserInfo) => user.display_name || user.email || user.id;

export const GlobalPermissionsSection = ({
  addDialogOpen,
  onCloseAddDialog,
}: {
  addDialogOpen: boolean;
  onCloseAddDialog: () => void;
}) => {
  const { user, reloadUser } = useAuth();
  const { data: users = [], isLoading: isLoadingUsers, error } = useAuthUsers();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const updateMutation = useUpdateUserGlobalRoles();

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => getUserLabel(left).localeCompare(getUserLabel(right))),
    [users]
  );

  const roleQueries = useQueries({
    queries: sortedUsers.map(sortedUser => ({
      queryKey: globalRolesKeys.roles(sortedUser.id),
      queryFn: () => fetchUserGlobalRoles(sortedUser.id),
      enabled: sortedUsers.length > 0,
      staleTime: 60 * 1000,
    })),
  });

  const roleMap = useMemo(() => {
    const next: Record<string, GlobalRole[]> = {};
    sortedUsers.forEach((sortedUser, index) => {
      const assignments = roleQueries[index]?.data ?? [];
      next[sortedUser.id] = assignments.map(assignment => assignment.role);
    });
    return next;
  }, [roleQueries, sortedUsers]);

  const assignedUsers = useMemo(
    () => sortedUsers.filter(sortedUser => (roleMap[sortedUser.id] ?? []).length > 0),
    [roleMap, sortedUsers]
  );

  const unassignedUsers = useMemo(
    () => sortedUsers.filter(sortedUser => (roleMap[sortedUser.id] ?? []).length === 0),
    [roleMap, sortedUsers]
  );

  const selectedUser = useMemo(
    () => sortedUsers.find(sortedUser => sortedUser.id === selectedUserId) ?? null,
    [selectedUserId, sortedUsers]
  );

  const isLoadingRoles = roleQueries.some(query => query.isLoading);
  const rolesError = roleQueries.find(query => query.error)?.error;

  if (error) {
    return <div className={styles.container}><div className={styles.error}>Failed to load users.</div></div>;
  }

  if (rolesError) {
    return <div className={styles.container}><div className={styles.error}>Failed to load global role assignments.</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrap}>
        {isLoadingUsers || isLoadingRoles ? (
          <div className={styles.empty}>Loading global role assignments…</div>
        ) : assignedUsers.length === 0 ? (
          <div className={styles.empty}>No users currently have global roles.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Global roles</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assignedUsers.map(assignedUser => {
                const assignedRoles = roleMap[assignedUser.id] ?? [];
                return (
                  <tr
                    key={assignedUser.id}
                    className={styles.clickableRow}
                    onClick={() => setSelectedUserId(assignedUser.id)}
                  >
                    <td className={styles.userCell}>
                      <div className={styles.userName}>{assignedUser.display_name}</div>
                      <div className={styles.userMeta}>
                        {assignedUser.email ?? assignedUser.id}
                      </div>
                    </td>
                    <td>
                      <div className={styles.assignedRoles}>
                        {assignedRoles.map(roleId => {
                          const role = GLOBAL_ROLES.find(candidate => candidate.id === roleId);
                          return role ? (
                            <Chip key={role.id} tone="ghost" dot={role.tone}>
                              {role.name}
                            </Chip>
                          ) : null;
                        })}
                      </div>
                    </td>
                    <td className={styles.statusCell}>
                      <Chip tone="ghost" dot={assignedUser.is_active ? 'var(--ok)' : 'var(--fg-3)'}>
                        {assignedUser.is_active ? 'Active' : 'Inactive'}
                      </Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <RoleAssignmentDialog
        key={selectedUser?.id ?? 'empty'}
        open={selectedUser != null}
        user={selectedUser}
        assignedRoles={selectedUser ? (roleMap[selectedUser.id] ?? []) : []}
        onClose={() => setSelectedUserId(null)}
        onSave={async roles => {
          if (!selectedUser) return;
          await updateMutation.mutateAsync({ userId: selectedUser.id, roles });
          if (selectedUser.id === user?.id) {
            await reloadUser();
          }
          setSelectedUserId(null);
        }}
        savingUserId={updateMutation.isPending ? updateMutation.variables?.userId ?? null : null}
      />

      <AddUserDialog
        open={addDialogOpen}
        users={unassignedUsers}
        onClose={onCloseAddDialog}
        onSelect={userId => {
          onCloseAddDialog();
          setSelectedUserId(userId);
        }}
      />
    </div>
  );
};

const RoleAssignmentDialog = ({
  open,
  user,
  assignedRoles,
  onClose,
  onSave,
  savingUserId,
}: {
  open: boolean;
  user: AuthUserInfo | null;
  assignedRoles: GlobalRole[];
  onClose: () => void;
  onSave: (roles: GlobalRole[]) => Promise<void>;
  savingUserId: string | null;
}) => {
  const [draftRoles, setDraftRoles] = useState<GlobalRole[]>(assignedRoles);

  useEffect(() => {
    setDraftRoles(assignedRoles);
  }, [assignedRoles]);

  if (!open || !user) return null;

  const isDirty = !sameRoles(draftRoles, assignedRoles);
  const isSaving = savingUserId === user.id;

  const toggleRole = (role: GlobalRole) => {
    setDraftRoles(current =>
      current.includes(role) ? current.filter(existingRole => existingRole !== role) : [...current, role]
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Global roles for ${getUserLabel(user)}`}>
      <div className={styles.dialogBody}>
        <div className={styles.dialogMeta}>{user.email ?? user.id}</div>
        <div className={styles.dialogList}>
          {GLOBAL_ROLES.map(role => (
            <label key={role.id} className={styles.dialogRoleRow}>
              <div>
                <div className={styles.dialogRoleTitle}>
                  <span className={styles.roleDot} style={{ background: role.tone }} />
                  {role.name}
                </div>
                <div className={styles.dialogRoleDescription}>{role.description}</div>
              </div>
              <input
                type="checkbox"
                checked={draftRoles.includes(role.id)}
                onChange={() => toggleRole(role.id)}
                disabled={isSaving}
              />
            </label>
          ))}
        </div>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onSave(draftRoles)}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save roles'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

const AddUserDialog = ({
  open,
  users,
  onClose,
  onSelect,
}: {
  open: boolean;
  users: AuthUserInfo[];
  onClose: () => void;
  onSelect: (userId: string) => void;
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedUserId(users[0]?.id ?? '');
    setTimeout(() => selectRef.current?.focus(), 0);
  }, [open, users]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Add user to global roles">
      <div className={styles.dialogBody}>
        {users.length === 0 ? (
          <div className={styles.emptyInline}>All existing users already have a global role assignment.</div>
        ) : (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>User</div>
                <div className={styles.fieldHint}>Select an existing user, then assign their global roles.</div>
              </div>
              <div className={styles.fieldRight}>
                <select
                  ref={selectRef}
                  className={styles.select}
                  value={selectedUserId}
                  onChange={event => setSelectedUserId(event.target.value)}
                >
                  {users.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {getUserLabel(candidate)}{candidate.email ? ` (${candidate.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btn} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => onSelect(selectedUserId)}
                disabled={!selectedUserId}
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
