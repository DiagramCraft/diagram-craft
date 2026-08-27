import { useMemo, useState } from 'react';
import { TbEdit } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { useAuth } from '../../../auth/AuthContext';
import { useAuthConfig } from '../../../hooks/useAuthConfig';
import { useAuthUsers } from '../../../hooks/useGlobalRoles';
import { useDeactivateManagedUser } from '../../../hooks/useUsers';
import { UserDialog } from '../../../components/UserDialog';
import { Banner } from '../../../components/Banner';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { MemberAvatar } from '../../../components/MemberAvatar';
import { SearchInput } from '../../../components/SearchInput';
import { Table } from '../../../components/table/Table';
import { getUserLabel } from '../../../utils/userLabel';
import type { UserSummary } from '@arch-register/api-types/authContract';
import styles from './UsersSubSection.module.css';

export const UsersSubSection = ({
  createDialogOpen,
  onCloseCreateDialog
}: {
  createDialogOpen: boolean;
  onCloseCreateDialog: () => void;
}) => {
  const { user: currentUser } = useAuth();
  const { data: authConfig } = useAuthConfig();
  const { data: users = [], isLoading, error } = useAuthUsers();
  const deactivateUser = useDeactivateManagedUser();
  const [query, setQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<UserSummary | null>(null);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...users]
      .filter(candidate => {
        if (!normalizedQuery) return true;
        return [candidate.user_id, candidate.display_name, candidate.email]
          .filter((value): value is string => value != null)
          .some(value => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => getUserLabel(left).localeCompare(getUserLabel(right)));
  }, [query, users]);

  if (authConfig?.mode === 'oidc') {
    return (
      <div className={styles.container}>
        <Banner variant="info">
          User management is unavailable while OIDC authentication is enabled.
        </Banner>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Banner variant="error">Failed to load users.</Banner>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!isLoading && users.length > 0 && (
        <div className={styles.toolbar}>
          <SearchInput
            size="sm"
            placeholder="Search by username, name, or email…"
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
          />
        </div>
      )}

      {deactivateUser.error && (
        <Banner variant="error">
          {deactivateUser.error instanceof Error
            ? deactivateUser.error.message
            : 'Unable to deactivate user.'}
        </Banner>
      )}

      {isLoading ? (
        <LoadingState text="Loading users…" size="sm" />
      ) : users.length === 0 ? (
        <EmptyState compact title="No users have been created yet." />
      ) : filteredUsers.length === 0 ? (
        <EmptyState compact title="No users match this search." />
      ) : (
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell style={{ minWidth: 260 }}>User</Table.HeaderCell>
              <Table.HeaderCell>Provider</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell align="right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {filteredUsers.map(candidate => {
              const isCurrentUser = candidate.id === currentUser?.id;
              const canDeactivate =
                candidate.is_active && !candidate.is_system_actor && !isCurrentUser;
              return (
                <Table.Row key={candidate.id}>
                  <Table.NameCell
                    icon={
                      <MemberAvatar
                        name={candidate.display_name}
                        email={candidate.email}
                        userId={candidate.id}
                        color={candidate.color}
                      />
                    }
                    title={candidate.display_name ?? candidate.user_id}
                    subtitle={candidate.email ?? candidate.user_id}
                  />
                  <Table.Cell>
                    <Chip tone="ghost">{candidate.auth_provider}</Chip>
                  </Table.Cell>
                  <Table.Cell>
                    {candidate.is_system_actor ? (
                      <Chip tone="ghost" dot="var(--cmp-fg-disabled)">
                        System
                      </Chip>
                    ) : (
                      <Chip
                        tone="ghost"
                        dot={candidate.is_active ? 'var(--green)' : 'var(--cmp-fg-disabled)'}
                      >
                        {candidate.is_active ? 'Active' : 'Inactive'}
                      </Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell align="right">
                    <div className={styles.actions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<TbEdit size={12} />}
                        disabled={candidate.is_system_actor}
                        onClick={() => setEditingUser(candidate)}
                      >
                        Edit
                      </Button>
                      {canDeactivate && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeactivatingUser(candidate)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      )}

      <UserDialog open={createDialogOpen} onClose={onCloseCreateDialog} />
      <UserDialog
        open={editingUser != null}
        user={editingUser}
        isCurrentUser={editingUser?.id === currentUser?.id}
        onClose={() => setEditingUser(null)}
        onUpdated={() => setEditingUser(null)}
      />
      <DeleteConfirmationDialog
        open={deactivatingUser != null}
        title={`Deactivate ${deactivatingUser?.display_name ?? 'user'}?`}
        message="This account will no longer be able to sign in. Existing memberships, roles, and history will be preserved."
        detail="You can reactivate the account later from Edit user."
        confirmLabel={deactivateUser.isPending ? 'Deactivating…' : 'Deactivate user'}
        onCancel={() => setDeactivatingUser(null)}
        onConfirm={() => {
          if (!deactivatingUser || deactivateUser.isPending) return;
          void deactivateUser.mutateAsync(deactivatingUser.id).then(() => {
            setDeactivatingUser(null);
          });
        }}
      />
    </div>
  );
};
