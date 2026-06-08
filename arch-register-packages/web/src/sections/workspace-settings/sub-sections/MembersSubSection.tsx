import { useEffect, useMemo, useState } from 'react';
import { TbSearch } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { Chip } from '../../../components/Chip';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { MemberAvatar, stableHue } from '../../../components/MemberAvatar';
import { useAuth } from '../../../auth/AuthContext';
import { getUserLabel } from '../../../utils/userLabel';
import {
  useWorkspaceMembers,
  useWorkspaceUsers,
  useUpdateWorkspaceMemberRole
} from '../../../hooks/useWorkspaceMembers';
import { useTeamAssignments, useTeams } from '../../../hooks/useWorkspaceConfig';
import { useWorkspaceRoles } from '../../../hooks/useWorkspaceRoles';
import styles from './MembersSubSection.module.css';
import type { WorkspaceRoleDefinition } from '../../../lib/api';

const TeamChip = ({ teamId }: { teamId: string }) => {
  const h = stableHue(teamId);
  return (
    <span className={styles.teamChip}>
      <span className={styles.teamChipBar} style={{ background: `oklch(0.65 0.15 ${h})` }} />
      {teamId}
    </span>
  );
};

const RoleMenu = ({
  current,
  roles,
  onSelect
}: {
  current: string;
  roles: WorkspaceRoleDefinition[];
  onSelect: (role: string) => void;
}) => {
  const roleMeta = roles.find(r => r.id === current);
  if (!roleMeta) return null;

  return (
    <DropdownMenu
      trigger={
        <button type="button" className={styles.roleBtn}>
          <Chip tone="ghost" dot={roleMeta.tone}>
            {roleMeta.name}
          </Chip>
        </button>
      }
      items={roles.map(role => ({
        label: role.name,
        icon: <span className={styles.roleMenuDot} style={{ background: role.tone }} />,
        onClick: () => onSelect(role.id)
      }))}
    />
  );
};

export const MembersSubSection = ({
  workspaceSlug,
  addDialogOpen,
  onCloseAddDialog
}: {
  workspaceSlug: string;
  addDialogOpen: boolean;
  onCloseAddDialog: () => void;
}) => {
  const { data: members = [], isLoading, error } = useWorkspaceMembers(workspaceSlug);
  const { data: users = [], isLoading: isLoadingUsers } = useWorkspaceUsers(workspaceSlug, true);
  const { data: roles = [] } = useWorkspaceRoles(workspaceSlug);
  const { data: teams = [] } = useTeams(workspaceSlug);
  const { data: teamAssignments = [] } = useTeamAssignments(workspaceSlug);
  const updateMemberRole = useUpdateWorkspaceMemberRole(workspaceSlug);
  const { user, reloadUser } = useAuth();

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
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

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load workspace members.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!isLoading && members.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <TbSearch size={12} />
            <input
              className={styles.searchInput}
              placeholder="Search by name or email…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Role</span>
            <select
              className={styles.filterSelect}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">Any role</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Team</span>
            <select
              className={styles.filterSelect}
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
            >
              <option value="">Any team</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.empty}>Loading members…</div>
        ) : members.length === 0 ? (
          <div className={styles.empty}>No members have been added to this workspace.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Member</th>
                <th>Role</th>
                <th>Teams</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No members match these filters.
                  </td>
                </tr>
              )}
              {filteredMembers.map(member => {
                const userInfo = usersById.get(member.user_id);
                const memberTeams = teamsByUser.get(member.user_id) ?? [];
                return (
                  <tr key={member.user_id}>
                    <td>
                      <div className={styles.memberName}>
                        <MemberAvatar
                          name={member.display_name}
                          email={member.email}
                          userId={member.user_id}
                          color={userInfo?.color ?? null}
                        />
                        <div>
                          <div className={styles.memberNameMain}>{member.display_name}</div>
                          <div className={styles.memberNameSub}>
                            {member.email ?? member.user_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleMenu
                        current={member.role}
                        roles={roles}
                        onSelect={role => {
                          void updateMemberRole
                            .mutateAsync({ userId: member.user_id, role })
                            .then(() => {
                              if (member.user_id === user?.id) {
                                void reloadUser();
                              }
                            });
                        }}
                      />
                    </td>
                    <td>
                      <div className={styles.tags}>
                        {memberTeams.length === 0 && <span className={styles.dim}>—</span>}
                        {memberTeams.slice(0, 2).map(t => (
                          <TeamChip key={t} teamId={t} />
                        ))}
                        {memberTeams.length > 2 && (
                          <span className={styles.teamChipOverflow}>+{memberTeams.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td>
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
                    </td>
                    <td className={styles.dim}>
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
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
          if (userId === user?.id) {
            await reloadUser();
          }
          onCloseAddDialog();
        }}
        isSaving={updateMemberRole.isPending}
        roles={roles}
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
  roles
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
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');

  useEffect(() => {
    if (!open) return;
    setSelectedUserId(users[0]?.id ?? '');
    setSelectedRole(roles.find(role => role.id === 'viewer')?.id ?? roles[0]?.id ?? '');
  }, [open, roles, users]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Add workspace member">
      <div className={styles.dialogBody}>
        {loading ? (
          <div className={styles.empty}>Loading users…</div>
        ) : users.length === 0 ? (
          <div className={styles.empty}>
            All existing users are already members of this workspace.
          </div>
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
                  value={selectedUserId || undefined}
                  onChange={value => setSelectedUserId(value ?? '')}
                  style={{ width: '100%' }}
                >
                  {users.map(user => (
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
                  value={selectedRole || undefined}
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
                onClick={() => void onSave(selectedUserId, selectedRole)}
                disabled={!selectedUserId || isSaving}
              >
                {isSaving ? 'Adding…' : 'Add member'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
