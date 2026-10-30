import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { TbEdit, TbUserMinus } from 'react-icons/tb';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { GLOBAL_ROLES, type GlobalRole } from '@arch-register/permissions';
import { useAuth } from '../../../auth/AuthContext';
import { Banner } from '../../../components/Banner';
import { Chip } from '../../../components/Chip';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { MemberAvatar } from '../../../components/MemberAvatar';
import { SearchInput } from '../../../components/SearchInput';
import { ViewControls } from '../../../components/ViewControls';
import { Table } from '../../../components/table/Table';
import { getUserLabel } from '../../../utils/userLabel';
import { useAuthUsers, useUpdateUserGlobalRoles } from '../../../hooks/useGlobalRoles';
import { userGlobalRolesQuery } from '../../../queries/globalRoles';
import { AddGlobalPermissionDialog } from '../dialogs/AddGlobalPermissionDialog';
import { EditGlobalPermissionDialog } from '../dialogs/EditGlobalPermissionDialog';
import { useGlobalSettingsSection } from '../useGlobalSettingsSection';
import { UserStatusChip } from '../UserStatusChip';
import styles from './GlobalPermissionsSubSection.module.css';

const RolesList = ({ roles }: { roles: GlobalRole[] }) => (
  <div className={styles.assignedRoles}>
    {roles.length === 0 && <span className={styles.noRoles}>No roles</span>}
    {roles.map(roleId => {
      const role = GLOBAL_ROLES.find(r => r.id === roleId);
      return role ? (
        <Chip key={role.id} tone="ghost" dot={role.tone}>
          {role.name}
        </Chip>
      ) : null;
    })}
  </div>
);

export const GlobalPermissionsSubSection = ({
  addDialogOpen,
  onCloseAddDialog
}: {
  addDialogOpen: boolean;
  onCloseAddDialog: () => void;
}) => {
  const { user, reloadUser } = useAuth();
  const { canManageUsers } = useGlobalSettingsSection();
  const { data: users = [], isLoading: isLoadingUsers, error } = useAuthUsers();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const updateMutation = useUpdateUserGlobalRoles();

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => getUserLabel(left).localeCompare(getUserLabel(right))),
    [users]
  );

  const roleQueries = useQueries({
    queries: sortedUsers.map(sortedUser => userGlobalRolesQuery(sortedUser.id))
  });

  const roleMap = useMemo(() => {
    const next: Record<string, GlobalRole[]> = {};
    sortedUsers.forEach((sortedUser, index) => {
      next[sortedUser.id] = (roleQueries[index]?.data ?? []).map(assignment => assignment.role);
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

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return assignedUsers;
    return assignedUsers.filter(candidate =>
      [candidate.user_id, candidate.display_name, candidate.email]
        .filter((value): value is string => value != null)
        .some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [assignedUsers, query]);

  const selectedUser = sortedUsers.find(candidate => candidate.id === selectedUserId) ?? null;
  const removingUser = sortedUsers.find(candidate => candidate.id === removingUserId) ?? null;

  const isLoadingRoles = roleQueries.some(query => query.isLoading);
  const rolesError = roleQueries.find(query => query.error)?.error;

  const saveRoles = async (userId: string, roles: GlobalRole[]) => {
    await updateMutation.mutateAsync({ userId, roles });
    if (userId === user?.id) await reloadUser();
  };

  if (error) {
    return (
      <div className={styles.container}>
        <Banner variant="error">Failed to load users.</Banner>
      </div>
    );
  }

  if (rolesError) {
    return (
      <div className={styles.container}>
        <Banner variant="error">Failed to load global role assignments.</Banner>
      </div>
    );
  }

  return (
    <>
      {updateMutation.error && (
        <Banner variant="error">
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : 'Unable to update global roles.'}
        </Banner>
      )}

      <div>
        {!isLoadingUsers && !isLoadingRoles && assignedUsers.length > 0 && (
          <ViewControls variant="page">
            <SearchInput
              size="sm"
              placeholder="Search by username, name, or email…"
              value={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
            />
          </ViewControls>
        )}

        {isLoadingUsers || isLoadingRoles ? (
          <LoadingState text="Loading global role assignments…" size="sm" />
        ) : assignedUsers.length === 0 ? (
          <EmptyState compact title="No users currently have global roles." />
        ) : filteredUsers.length === 0 ? (
          <EmptyState compact title="No users match this search." />
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell style={{ minWidth: 240 }}>User</Table.HeaderCell>
                <Table.HeaderCell>Global roles</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell align="right" />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {filteredUsers.map(assignedUser => (
                <Table.Row key={assignedUser.id} onClick={() => setSelectedUserId(assignedUser.id)}>
                  <Table.NameCell
                    icon={
                      <MemberAvatar
                        name={assignedUser.display_name}
                        email={assignedUser.email}
                        userId={assignedUser.id}
                        color={assignedUser.color}
                      />
                    }
                    title={assignedUser.display_name ?? assignedUser.user_id}
                    subtitle={assignedUser.email ?? assignedUser.user_id}
                  />
                  <Table.Cell>
                    <RolesList roles={roleMap[assignedUser.id] ?? []} />
                  </Table.Cell>
                  <Table.Cell>
                    <UserStatusChip
                      isSystemActor={assignedUser.is_system_actor}
                      isActive={assignedUser.is_active}
                    />
                  </Table.Cell>
                  <Table.ActionsCell>
                    <DropdownMenu
                      trigger={
                        <Table.DotsButton
                          aria-label={`Actions for ${getUserLabel(assignedUser)}`}
                        />
                      }
                      items={
                        [
                          {
                            label: 'Edit',
                            icon: <TbEdit size={14} />,
                            onClick: () => setSelectedUserId(assignedUser.id)
                          },
                          {
                            label: 'Remove all roles',
                            icon: <TbUserMinus size={14} />,
                            danger: true,
                            onClick: () => setRemovingUserId(assignedUser.id)
                          }
                        ] satisfies MenuItem[]
                      }
                    />
                  </Table.ActionsCell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </div>

      {selectedUser && (
        <EditGlobalPermissionDialog
          key={selectedUser.id}
          user={selectedUser}
          assignedRoles={roleMap[selectedUser.id] ?? []}
          isSaving={updateMutation.isPending}
          onClose={() => setSelectedUserId(null)}
          onSave={async roles => {
            await saveRoles(selectedUser.id, roles);
            setSelectedUserId(null);
          }}
        />
      )}

      {addDialogOpen && (
        <AddGlobalPermissionDialog
          users={unassignedUsers}
          canCreateUsers={canManageUsers}
          isSaving={updateMutation.isPending}
          onClose={onCloseAddDialog}
          onCreated={userId => {
            onCloseAddDialog();
            setSelectedUserId(userId);
          }}
          onSave={async (userId, roles) => {
            await saveRoles(userId, roles);
            onCloseAddDialog();
          }}
        />
      )}

      <DeleteConfirmationDialog
        open={removingUser != null}
        title={`Remove all global roles from ${removingUser ? getUserLabel(removingUser) : 'user'}?`}
        message="This user will lose all platform-wide permissions. Their account and workspace memberships are not affected."
        confirmLabel={updateMutation.isPending ? 'Removing…' : 'Remove roles'}
        onCancel={() => setRemovingUserId(null)}
        onConfirm={() => {
          if (!removingUser || updateMutation.isPending) return;
          void saveRoles(removingUser.id, []).then(() => setRemovingUserId(null));
        }}
      />
    </>
  );
};
