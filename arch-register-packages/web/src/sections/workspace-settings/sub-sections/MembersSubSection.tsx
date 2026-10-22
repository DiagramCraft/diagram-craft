import { SettingsPage } from '../SettingsBlock';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus } from 'react-icons/tb';
import { SectionActions } from '../SectionActions';
import { Select } from '@diagram-craft/app-components/Select';
import { Banner } from '../../../components/Banner';
import { Chip } from '../../../components/Chip';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { MemberAvatar, stableHue } from '../../../components/MemberAvatar';
import { SearchInput } from '../../../components/SearchInput';
import { ToolbarFilterBar, ToolbarFilterSelect } from '../../../components/ToolbarFilter';
import { useAuth } from '../../../auth/AuthContext';
import { useAuthConfig } from '../../../hooks/useAuthConfig';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { getUserLabel } from '../../../utils/userLabel';
import { formatDate } from '../../../utils/dateFormat';
import {
  useWorkspaceMembers,
  useWorkspaceUsers,
  useUpdateWorkspaceMemberRole
} from '../../../hooks/useWorkspaceMembers';
import { useTeamAssignments, useTeams } from '../../../hooks/useWorkspaceConfig';
import { useWorkspaceRoles } from '../../../hooks/useWorkspaceRoles';
import { Table } from '../../../components/table/Table';
import styles from './MembersSubSection.module.css';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { WorkspaceRoleDefinition } from '@arch-register/api-types/workspaceContract';
import { UserDialog } from '../../../components/UserDialog';

const TeamChip = ({ teamId, label }: { teamId: string; label: string }) => {
  const h = stableHue(teamId);
  return (
    <span className={styles.teamChip}>
      <span className={styles.teamChipBar} style={{ background: `oklch(0.65 0.15 ${h})` }} />
      {label}
    </span>
  );
};

const RoleChip = ({ current, roles }: { current: string; roles: WorkspaceRoleDefinition[] }) => {
  const roleMeta = roles.find(r => r.id === current);
  if (!roleMeta) return null;
  return (
    <Chip tone="ghost" dot={roleMeta.tone}>
      {roleMeta.name}
    </Chip>
  );
};

export const MembersSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const onCloseAddDialog = () => setAddDialogOpen(false);
  const { data: members = [], isLoading, error } = useWorkspaceMembers(workspaceSlug);
  const { data: users = [], isLoading: isLoadingUsers } = useWorkspaceUsers(workspaceSlug, true);
  const { data: roles = [] } = useWorkspaceRoles(workspaceSlug);
  const { data: teams = [] } = useTeams(workspaceSlug);
  const { data: teamAssignments = [] } = useTeamAssignments(workspaceSlug);
  const updateMemberRole = useUpdateWorkspaceMemberRole(workspaceSlug);
  const { user, reloadUser } = useAuth();
  const { data: authConfig } = useAuthConfig();
  const { hasGlobalPermission } = useWorkspaceAuthorization(workspaceSlug);
  const canCreateUsers =
    authConfig != null && authConfig.mode !== 'oidc' && hasGlobalPermission('admin_platform');

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const teamsById = useMemo(() => new Map(teams.map(team => [team.id, team])), [teams]);
  const teamsByUser = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of teamAssignments) {
      const list = map.get(a.user_id) ?? [];
      if (!list.includes(a.team_id)) list.push(a.team_id);
      map.set(a.user_id, list);
    }
    return map;
  }, [teamAssignments]);

  const filteredMembers = useMemo(() => {
    let result = members;
    if (roleFilter) result = result.filter(m => m.role === roleFilter);
    if (teamFilter)
      result = result.filter(m => (teamsByUser.get(m.user_id) ?? []).includes(teamFilter));
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        m =>
          m.display_name.toLowerCase().includes(q) || (m.email?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [members, roleFilter, teamFilter, query, teamsByUser]);

  const memberIds = useMemo(() => new Set(members.map(member => member.user_id)), [members]);
  const availableUsers = useMemo(
    () => users.filter(user => !memberIds.has(user.id)),
    [memberIds, users]
  );

  const header = (
    <SectionActions>
      <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setAddDialogOpen(true)}>
        Add user
      </Button>
    </SectionActions>
  );

  if (error) {
    return (
      <>
        {header}
        <SettingsPage stacked={false}>
          <Banner variant="error">Failed to load workspace members.</Banner>
        </SettingsPage>
      </>
    );
  }

  return (
    <>
      {header}
      <SettingsPage stacked={false}>
        {!isLoading && members.length > 0 && (
          <ToolbarFilterBar>
            <SearchInput
              size="sm"
              placeholder="Search by name or email…"
              value={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
            />
            <ToolbarFilterSelect
              label="Role"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: '', label: 'Any role' },
                ...roles.map(r => ({ value: r.id, label: r.name }))
              ]}
            />
            <ToolbarFilterSelect
              label="Team"
              value={teamFilter}
              onChange={setTeamFilter}
              options={[
                { value: '', label: 'Any team' },
                ...teams.map(t => ({ value: t.id, label: t.name }))
              ]}
            />
          </ToolbarFilterBar>
        )}
        {isLoading ? (
          <LoadingState text="Loading members…" size="sm" />
        ) : members.length === 0 ? (
          <EmptyState compact title="No members have been added to this workspace." />
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell style={{ minWidth: 240 }}>Member</Table.HeaderCell>
                <Table.HeaderCell>Role</Table.HeaderCell>
                <Table.HeaderCell>Teams</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Added</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {filteredMembers.length === 0 && (
                <Table.EmptyRow colSpan={5} title="No members match these filters." />
              )}
              {filteredMembers.map(member => {
                const userInfo = usersById.get(member.user_id);
                const memberTeams = teamsByUser.get(member.user_id) ?? [];
                return (
                  <Table.Row key={member.user_id} onClick={() => setEditingUserId(member.user_id)}>
                    <Table.NameCell
                      icon={
                        <MemberAvatar
                          name={member.display_name}
                          email={member.email}
                          userId={member.user_id}
                          color={userInfo?.color ?? null}
                        />
                      }
                      title={member.display_name}
                      subtitle={member.email ?? member.user_id}
                    />
                    <Table.Cell>
                      <RoleChip current={member.role} roles={roles} />
                    </Table.Cell>
                    <Table.Cell>
                      <div className={styles.tags}>
                        {memberTeams.length === 0 && <span className={styles.dim}>—</span>}
                        {memberTeams.slice(0, 2).map(teamId => (
                          <TeamChip
                            key={teamId}
                            teamId={teamId}
                            label={teamsById.get(teamId)?.name ?? teamId}
                          />
                        ))}
                        {memberTeams.length > 2 && (
                          <span className={styles.teamChipOverflow}>+{memberTeams.length - 2}</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {userInfo ? (
                        <Chip
                          tone="ghost"
                          dot={userInfo.is_active ? 'var(--green)' : 'var(--cmp-fg-disabled)'}
                        >
                          {userInfo.is_active ? 'Active' : 'Inactive'}
                        </Chip>
                      ) : (
                        <span className={styles.dim}>—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className={styles.dim}>{formatDate(member.created_at)}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
        <EditMemberDialog
          member={members.find(m => m.user_id === editingUserId) ?? null}
          roles={roles}
          isSaving={updateMemberRole.isPending}
          onClose={() => setEditingUserId(null)}
          onSave={async (userId, role) => {
            await updateMemberRole.mutateAsync({ userId, role });
            if (userId === user?.id) {
              await reloadUser();
            }
            setEditingUserId(null);
          }}
        />
        <AddMemberDialog
          open={addDialogOpen}
          users={availableUsers}
          loading={isLoadingUsers}
          onClose={onCloseAddDialog}
          onSave={async (userId, role) => {
            await updateMemberRole.mutateAsync({ userId, role });
            if (userId === user?.id) {
              await reloadUser();
            }
            onCloseAddDialog();
          }}
          isSaving={updateMemberRole.isPending}
          roles={roles}
          canCreateUsers={canCreateUsers}
        />
      </SettingsPage>
    </>
  );
};

const AddMemberDialog = ({
  open,
  users,
  loading,
  onClose,
  onSave,
  isSaving,
  roles,
  canCreateUsers
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
  onSave: (userId: string, role: string) => Promise<void>;
  isSaving: boolean;
  roles: WorkspaceRoleDefinition[];
  canCreateUsers: boolean;
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [createdUser, setCreatedUser] = useState<{
    id: string;
    email: string | null;
    display_name: string;
    is_active: boolean;
  } | null>(null);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCreatedUser(null);
    setSelectedUserId('');
    setSelectedRole(roles.find(role => role.id === 'viewer')?.id ?? roles[0]?.id ?? '');
  }, [open, roles]);

  useEffect(() => {
    if (open && !selectedUserId && users.length > 0) {
      setSelectedUserId(users[0]!.id);
    }
  }, [open, selectedUserId, users]);

  if (!open) return null;

  const selectableUsers =
    createdUser && !users.some(user => user.id === createdUser.id)
      ? [...users, createdUser]
      : users;

  return (
    <Dialog open={open} onClose={onClose} title="Add workspace member">
      <div className={styles.dialogBody}>
        {loading ? (
          <EmptyState compact title="Loading users…" />
        ) : selectableUsers.length === 0 ? (
          <>
            <EmptyState compact title="All existing users are already members of this workspace." />
            {canCreateUsers && (
              <div className={styles.dialogActions}>
                <Button variant="secondary" onClick={() => setCreateUserDialogOpen(true)}>
                  Create new user
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>User</div>
                <div className={styles.fieldHint}>
                  Choose an existing user to add to this workspace.
                </div>
              </div>
              <div className={styles.fieldRight}>
                <Select.Root
                  value={selectedUserId ?? undefined}
                  onChange={value => setSelectedUserId(value ?? '')}
                  style={{ width: '100%' }}
                >
                  {selectableUsers.map(user => (
                    <Select.Item key={user.id} value={user.id}>
                      {getUserLabel(user)}
                      {user.email && user.email !== getUserLabel(user) ? ` (${user.email})` : ''}
                      {!user.is_active ? ' - inactive' : ''}
                    </Select.Item>
                  ))}
                </Select.Root>
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>Role</div>
                <div className={styles.fieldHint}>
                  Set the workspace role that will be stored on this membership.
                </div>
              </div>
              <div className={styles.fieldRight}>
                <Select.Root
                  value={selectedRole ?? undefined}
                  onChange={value => setSelectedRole(value ?? '')}
                  style={{ width: '100%' }}
                >
                  {roles.map(role => (
                    <Select.Item key={role.id} value={role.id}>
                      {role.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </div>
            </div>
            <div className={styles.dialogActions}>
              {canCreateUsers && (
                <Button variant="secondary" onClick={() => setCreateUserDialogOpen(true)}>
                  Create new user
                </Button>
              )}
              <Button onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void onSave(selectedUserId, selectedRole)}
                disabled={!selectedUserId || isSaving}
              >
                {isSaving ? 'Adding…' : 'Add member'}
              </Button>
            </div>
          </>
        )}
        <UserDialog
          open={createUserDialogOpen}
          onClose={() => setCreateUserDialogOpen(false)}
          onCreated={created => {
            setCreatedUser({
              id: created.id,
              email: created.email,
              display_name: created.display_name ?? '',
              is_active: created.is_active
            });
            setSelectedUserId(created.id);
            setCreateUserDialogOpen(false);
          }}
        />
      </div>
    </Dialog>
  );
};

const EditMemberDialog = ({
  member,
  roles,
  isSaving,
  onClose,
  onSave
}: {
  member: { user_id: string; display_name: string; email: string | null; role: string } | null;
  roles: WorkspaceRoleDefinition[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (userId: string, role: string) => Promise<void>;
}) => {
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    setSelectedRole(member?.role ?? '');
  }, [member]);

  if (!member) return null;

  return (
    <Dialog open onClose={onClose} title="Edit workspace member">
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Member</div>
          </div>
          <div className={styles.fieldRight}>
            {member.display_name}
            {member.email ? ` (${member.email})` : ''}
          </div>
        </div>
        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Role</div>
            <div className={styles.fieldHint}>
              Set the workspace role that is stored on this membership.
            </div>
          </div>
          <div className={styles.fieldRight}>
            <Select.Root
              value={selectedRole}
              onChange={value => setSelectedRole(value ?? '')}
              style={{ width: '100%' }}
            >
              {roles.map(role => (
                <Select.Item key={role.id} value={role.id}>
                  {role.name}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
        </div>
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSave(member.user_id, selectedRole)}
            disabled={!selectedRole || selectedRole === member.role || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
