import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { GLOBAL_ROLES, type GlobalRole } from '@arch-register/permissions';
import { useAuth } from '../../../auth/AuthContext';
import { Chip } from '../../../components/Chip';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { MemberAvatar } from '../../../components/MemberAvatar';
import { getUserLabel } from '../../../utils/userLabel';
import {
  useAuthUsers,
  useUpdateUserGlobalRoles,
  globalRolesKeys
} from '../../../hooks/useGlobalRoles';
import { orpcClient } from '../../../lib/orpcClient';
import { Table } from '../../../components/table/Table';
import styles from './GlobalPermissionsSubSection.module.css';

type AuthUserInfo = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  auth_provider: string;
  is_active: boolean;
  color: string | null;
};

const sameRoles = (left: GlobalRole[], right: GlobalRole[]) => {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((role, index) => role === sortedRight[index]);
};

const RolesMenu = ({
  currentRoles,
  onToggle
}: {
  currentRoles: GlobalRole[];
  onToggle: (role: GlobalRole) => void;
}) => {
  return (
    <DropdownMenu
      trigger={
        <button type="button" className={styles.roleBtn}>
          <div className={styles.assignedRoles}>
            {currentRoles.length === 0 && <span className={styles.noRoles}>No roles</span>}
            {currentRoles.map(roleId => {
              const role = GLOBAL_ROLES.find(r => r.id === roleId);
              return role ? (
                <Chip key={role.id} tone="ghost" dot={role.tone}>
                  {role.name}
                </Chip>
              ) : null;
            })}
          </div>
        </button>
      }
      items={GLOBAL_ROLES.map(role => ({
        label: role.name,
        icon: (
          <span className={styles.roleMenuCheck}>
            {currentRoles.includes(role.id) ? '\u2713' : '\u00A0'}
          </span>
        ),
        keepOpen: true,
        onClick: () => onToggle(role.id)
      }))}
    />
  );
};

export const GlobalPermissionsSubSection = ({
  addDialogOpen,
  onCloseAddDialog
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
      queryFn: () => orpcClient.authProtected.getGlobalRoles({ params: { id: sortedUser.id } }),
      enabled: sortedUsers.length > 0,
      staleTime: 60 * 1000
    }))
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
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load users.</div>
      </div>
    );
  }

  if (rolesError) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load global role assignments.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {isLoadingUsers || isLoadingRoles ? (
        <div className={styles.empty}>Loading global role assignments…</div>
      ) : assignedUsers.length === 0 ? (
        <div className={styles.empty}>No users currently have global roles.</div>
      ) : (
        <Table.Root>
          <Table.Head>
            <tr>
              <Table.HeaderCell style={{ minWidth: 240 }}>User</Table.HeaderCell>
              <Table.HeaderCell>Global roles</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </tr>
          </Table.Head>
          <Table.Body>
            {assignedUsers.map(assignedUser => {
              const assignedRoles = roleMap[assignedUser.id] ?? [];
              return (
                <Table.Row key={assignedUser.id}>
                  <Table.NameCell
                    icon={
                      <MemberAvatar
                        name={assignedUser.display_name}
                        email={assignedUser.email}
                        userId={assignedUser.id}
                      />
                    }
                    title={assignedUser.display_name}
                    subtitle={assignedUser.email ?? assignedUser.id}
                  />
                  <Table.Cell>
                    <RolesMenu
                      currentRoles={assignedRoles}
                      onToggle={role => {
                        const next = assignedRoles.includes(role)
                          ? assignedRoles.filter(r => r !== role)
                          : [...assignedRoles, role];
                        void updateMutation
                          .mutateAsync({ userId: assignedUser.id, roles: next })
                          .then(() => {
                            if (assignedUser.id === user?.id) void reloadUser();
                          });
                      }}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Chip
                      tone="ghost"
                      dot={assignedUser.is_active ? 'var(--green)' : 'var(--cmp-fg-disabled)'}
                    >
                      {assignedUser.is_active ? 'Active' : 'Inactive'}
                    </Chip>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      )}

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
        savingUserId={updateMutation.isPending ? (updateMutation.variables?.userId ?? null) : null}
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
  savingUserId
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
      current.includes(role)
        ? current.filter(existingRole => existingRole !== role)
        : [...current, role]
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
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSave(draftRoles)}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save roles'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

const AddUserDialog = ({
  open,
  users,
  onClose,
  onSelect
}: {
  open: boolean;
  users: AuthUserInfo[];
  onClose: () => void;
  onSelect: (userId: string) => void;
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setSelectedUserId(users[0]?.id ?? '');
  }, [open, users]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Add user to global roles">
      <div className={styles.dialogBody}>
        {users.length === 0 ? (
          <div className={styles.emptyInline}>
            All existing users already have a global role assignment.
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>User</div>
                <div className={styles.fieldHint}>
                  Select an existing user, then assign their global roles.
                </div>
              </div>
              <div className={styles.fieldRight}>
                <Select.Root
                  value={selectedUserId || undefined}
                  onChange={value => setSelectedUserId(value ?? '')}
                  style={{ width: '100%' }}
                >
                  {users.map(candidate => (
                    <Select.Item key={candidate.id} value={candidate.id}>
                      {getUserLabel(candidate)}
                      {candidate.email ? ` (${candidate.email})` : ''}
                    </Select.Item>
                  ))}
                </Select.Root>
              </div>
            </div>
            <div className={styles.dialogActions}>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => onSelect(selectedUserId)}
                disabled={!selectedUserId}
              >
                Continue
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
