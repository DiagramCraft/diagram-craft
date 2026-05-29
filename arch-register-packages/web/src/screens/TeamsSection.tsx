import { type TeamRole } from '@arch-register/permissions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TbChevronRight, TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { DropdownMenu } from '../components/DropdownMenu';
import type { TeamAssignmentInfo, WorkspaceTeam, WorkspaceUserInfo } from '../api';
import { useWorkspaceUsers } from '../hooks/useWorkspaceMembers';
import {
  useTeamAssignments,
  useTeams,
  useUpdateTeamAssignments,
  useUpdateTeams,
} from '../hooks/useWorkspaceConfig';
import styles from './TeamsSection.module.css';

type TeamDraft = {
  id: string;
  assignments: EditAssignment[];
};

type EditAssignment = {
  user_id: string;
  role: TeamRole;
};

const TEAM_ROLE_OPTIONS: Array<{ value: TeamRole; label: string; tone: string; description: string }> = [
  {
    value: 'team_admin',
    label: 'Team admin',
    tone: 'var(--danger)',
    description: 'Full owner-team access plus team administration.',
  },
  {
    value: 'team_editor',
    label: 'Team editor',
    tone: 'var(--accent)',
    description: 'Can edit owned entities and projects.',
  },
  {
    value: 'team_reviewer',
    label: 'Team reviewer',
    tone: 'var(--ok)',
    description: 'Read-only access across owned content.',
  },
];

const sortAssignments = (assignments: EditAssignment[]) =>
  [...assignments].sort((left, right) => {
    const userCompare = left.user_id.localeCompare(right.user_id);
    return userCompare !== 0 ? userCompare : left.role.localeCompare(right.role);
  });

const buildTeamDrafts = (
  teams: WorkspaceTeam[],
  assignments: TeamAssignmentInfo[]
): TeamDraft[] =>
  teams.map(team => ({
    id: team.id,
    assignments: sortAssignments(
      assignments
        .filter(assignment => assignment.team_id === team.id)
        .map(assignment => ({ user_id: assignment.user_id, role: assignment.role }))
    ),
  }));

const toOwnerPayload = (teams: TeamDraft[]) =>
  teams.map((team, index) => ({ id: team.id.trim(), sort_order: index }));

const toMembershipPayload = (teams: TeamDraft[]) =>
  teams.flatMap(team =>
    team.assignments
      .filter(assignment => team.id.trim().length > 0 && assignment.user_id.trim().length > 0)
      .map(assignment => ({
        team_id: team.id.trim(),
        user_id: assignment.user_id,
        role: assignment.role,
      }))
  );

const getUserLabel = (user: WorkspaceUserInfo) =>
  user.display_name || user.email || user.id;

const getUserInitials = (user: WorkspaceUserInfo) => {
  const name = user.display_name || user.email || user.id;
  return name
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
};

const stableHue = (id: string) => {
  let hash = 0;
  for (const ch of id) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
};

const MemberAvatar = ({ user, size = 24 }: { user: WorkspaceUserInfo | undefined; size?: number }) => {
  if (!user) return null;
  const h = stableHue(user.id);
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        background: `linear-gradient(135deg, oklch(0.52 0.13 ${h}), oklch(0.42 0.10 ${(h + 32) % 360}))`,
      }}
      title={getUserLabel(user)}
    >
      {getUserInitials(user)}
    </span>
  );
};

const getRoleOption = (role: TeamRole) =>
  TEAM_ROLE_OPTIONS.find(r => r.value === role);

const RoleMenu = ({
  current,
  disabled,
  onSelect,
}: {
  current: TeamRole;
  disabled: boolean;
  onSelect: (role: TeamRole) => void;
}) => {
  const roleOpt = getRoleOption(current);

  if (disabled || !roleOpt) {
    return roleOpt ? (
      <Chip tone="ghost" dot={roleOpt.tone}>{roleOpt.label}</Chip>
    ) : null;
  }

  return (
    <DropdownMenu
      trigger={
        <button type="button" className={styles.roleBtn}>
          <Chip tone="ghost" dot={roleOpt.tone}>{roleOpt.label}</Chip>
        </button>
      }
      items={TEAM_ROLE_OPTIONS.map(role => ({
        label: role.label,
        icon: <span className={styles.roleMenuDot} style={{ background: role.tone }} />,
        onClick: () => onSelect(role.value),
      }))}
    />
  );
};

export const TeamsSection = ({
  workspaceSlug,
  addDialogOpen,
  onCloseAddDialog,
}: {
  workspaceSlug: string;
  addDialogOpen: boolean;
  onCloseAddDialog: () => void;
}) => {
  const { data: teams = [], isLoading: isLoadingTeams, error: teamsError } = useTeams(workspaceSlug);
  const { data: assignments = [], isLoading: isLoadingAssignments, error: assignmentsError } = useTeamAssignments(workspaceSlug);
  const { data: users = [], isLoading: isLoadingUsers } = useWorkspaceUsers(workspaceSlug, true);
  const updateTeams = useUpdateTeams(workspaceSlug);
  const updateTeamAssignments = useUpdateTeamAssignments(workspaceSlug);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [addMembersTeamId, setAddMembersTeamId] = useState<string | null>(null);

  const teamDrafts = useMemo(() => buildTeamDrafts(teams, assignments), [assignments, teams]);
  const editTeam = useMemo(
    () => teamDrafts.find(team => team.id === editTeamId) ?? null,
    [editTeamId, teamDrafts]
  );
  const addMembersTeam = useMemo(
    () => teamDrafts.find(team => team.id === addMembersTeamId) ?? null,
    [addMembersTeamId, teamDrafts]
  );
  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  const isSaving = updateTeams.isPending || updateTeamAssignments.isPending;

  const changeRole = async (teamId: string, userId: string, newRole: TeamRole) => {
    const nextTeams = teamDrafts.map(team =>
      team.id === teamId
        ? {
            ...team,
            assignments: team.assignments.map(a =>
              a.user_id === userId ? { ...a, role: newRole } : a
            ),
          }
        : team
    );
    await persistTeams(nextTeams, updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
  };

  const removeMember = async (teamId: string, userId: string) => {
    const nextTeams = teamDrafts.map(team =>
      team.id === teamId
        ? { ...team, assignments: team.assignments.filter(a => a.user_id !== userId) }
        : team
    );
    await persistTeams(nextTeams, updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
  };

  if (teamsError || assignmentsError) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load teams.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {isLoadingTeams || isLoadingAssignments ? (
        <div className={styles.empty}>Loading teams…</div>
      ) : teamDrafts.length === 0 ? (
        <div className={styles.empty}>No owner teams have been created for this workspace.</div>
      ) : (
        <div className={styles.teamList}>
          {teamDrafts.map(team => {
            const teamAssignments = sortAssignments(team.assignments);
            const isOpen = openId === team.id;
            const adminAssignment = teamAssignments.find(a => a.role === 'team_admin');
            const leadUser = adminAssignment ? usersById.get(adminAssignment.user_id) : undefined;
            return (
              <div key={team.id} className={`${styles.teamCard} ${isOpen ? styles.teamCardOpen : ''}`}>
                <button
                  type="button"
                  className={styles.teamCardHead}
                  onClick={() => setOpenId(isOpen ? null : team.id)}
                >
                  <span
                    className={styles.teamColorBar}
                    style={{ background: `oklch(0.65 0.15 ${stableHue(team.id)})` }}
                  />
                  <span className={styles.teamName}>{team.id}</span>
                  <span className={styles.teamLeadRow}>
                    {leadUser && (
                      <>
                        <span className={styles.dim}>Lead</span>
                        <MemberAvatar user={leadUser} size={18} />
                        <span>{getUserLabel(leadUser)}</span>
                      </>
                    )}
                  </span>
                  <span className={styles.teamCount}>{teamAssignments.length}</span>
                  <span className={styles.teamAvatars}>
                    {teamAssignments.slice(0, 4).map(a => (
                      <MemberAvatar key={a.user_id} user={usersById.get(a.user_id)} size={20} />
                    ))}
                    {teamAssignments.length > 4 && (
                      <span className={styles.avatarMore}>+{teamAssignments.length - 4}</span>
                    )}
                  </span>
                  <TbChevronRight
                    size={11}
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className={styles.teamCardBody}>
                    <div className={styles.teamActions}>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => setEditTeamId(team.id)}
                      >
                        <TbEdit size={11} /> Edit team
                      </button>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => setAddMembersTeamId(team.id)}
                      >
                        <TbPlus size={11} /> Add members
                      </button>
                      <div style={{ flex: 1 }} />
                      <span className={styles.dim}>
                        {teamAssignments.length} {teamAssignments.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    <div className={styles.teamMembers}>
                      {teamAssignments.length === 0 ? (
                        <div className={styles.emptyInline}>No users assigned to this team.</div>
                      ) : (
                        teamAssignments.map(a => {
                          const user = usersById.get(a.user_id);
                          return (
                            <div key={a.user_id} className={styles.teamMember}>
                              <MemberAvatar user={user} size={24} />
                              <div className={styles.teamMemberName}>
                                <div>{user ? getUserLabel(user) : a.user_id}</div>
                                <div className={`${styles.dim} ${styles.mono}`}>
                                  {user?.email ?? ''}
                                </div>
                              </div>
                              <RoleMenu
                                current={a.role}
                                disabled={isSaving}
                                onSelect={newRole => void changeRole(team.id, a.user_id, newRole)}
                              />
                              <button
                                type="button"
                                className={styles.removeMemberBtn}
                                title="Remove from team"
                                disabled={isSaving}
                                onClick={() => void removeMember(team.id, a.user_id)}
                              >
                                <TbTrash size={11} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TeamDialog
        key={editTeam?.id ?? 'edit-empty'}
        open={editTeam != null}
        mode="edit"
        initialTeamId={editTeam?.id ?? ''}
        onClose={() => setEditTeamId(null)}
        onSave={async newId => {
          if (!editTeam) return;
          const renamedTeam = { ...editTeam, id: newId };
          const nextTeams = teamDrafts.map(team => (team.id === editTeam.id ? renamedTeam : team));
          await persistTeams(nextTeams, updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
          setEditTeamId(newId);
          if (openId === editTeam.id) setOpenId(newId);
        }}
        isSaving={isSaving}
      />

      <TeamDialog
        open={addDialogOpen}
        mode="create"
        initialTeamId=""
        onClose={onCloseAddDialog}
        onSave={async newId => {
          await persistTeams(
            [...teamDrafts, { id: newId, assignments: [] }],
            updateTeams.mutateAsync,
            updateTeamAssignments.mutateAsync
          );
          onCloseAddDialog();
        }}
        isSaving={isSaving}
      />

      <AddMembersDialog
        open={addMembersTeam != null}
        teamId={addMembersTeam?.id ?? ''}
        existingUserIds={addMembersTeam?.assignments.map(a => a.user_id) ?? []}
        users={users}
        loadingUsers={isLoadingUsers}
        onClose={() => setAddMembersTeamId(null)}
        onSave={async newAssignments => {
          if (!addMembersTeam) return;
          const nextTeams = teamDrafts.map(team =>
            team.id === addMembersTeam.id
              ? { ...team, assignments: [...team.assignments, ...newAssignments] }
              : team
          );
          await persistTeams(nextTeams, updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
          setAddMembersTeamId(null);
        }}
        isSaving={isSaving}
      />
    </div>
  );
};

const persistTeams = async (
  teams: TeamDraft[],
  saveOwners: (owners: Array<{ id: string; sort_order: number }>) => Promise<unknown>,
  saveMemberships: (
    memberships: Array<{ team_id: string; user_id: string; role: TeamRole }>
  ) => Promise<unknown>
) => {
  const cleanTeams = teams
    .map(team => ({ ...team, id: team.id.trim() }))
    .filter(team => team.id.length > 0);
  await saveOwners(toOwnerPayload(cleanTeams));
  await saveMemberships(toMembershipPayload(cleanTeams));
};

const TeamDialog = ({
  open,
  mode,
  initialTeamId,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initialTeamId: string;
  onClose: () => void;
  onSave: (teamId: string) => Promise<void>;
  isSaving: boolean;
}) => {
  const [teamId, setTeamId] = useState(initialTeamId);
  const teamInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTeamId(initialTeamId);
    setTimeout(() => teamInputRef.current?.focus(), 0);
  }, [initialTeamId, open]);

  if (!open) return null;

  const isDirty = teamId.trim() !== initialTeamId;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Add team' : 'Edit team'}
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Name</div>
            <div className={styles.fieldHint}>Used as the owner value for entities and projects.</div>
          </div>
          <div className={styles.fieldRight}>
            <input
              ref={teamInputRef}
              className={styles.input}
              value={teamId}
              onChange={event => setTeamId(event.target.value)}
              placeholder="platform-team"
            />
          </div>
        </div>

        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onSave(teamId.trim())}
            disabled={!teamId.trim() || !isDirty || isSaving}
          >
            {isSaving ? 'Saving…' : mode === 'create' ? 'Add team' : 'Save team'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

const AddMembersDialog = ({
  open,
  teamId,
  existingUserIds,
  users,
  loadingUsers,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  teamId: string;
  existingUserIds: string[];
  users: WorkspaceUserInfo[];
  loadingUsers: boolean;
  onClose: () => void;
  onSave: (assignments: EditAssignment[]) => Promise<void>;
  isSaving: boolean;
}) => {
  const [assignments, setAssignments] = useState<EditAssignment[]>([]);

  useEffect(() => {
    if (!open) return;
    setAssignments([]);
  }, [open]);

  if (!open) return null;

  const pickedUserIds = new Set(assignments.map(a => a.user_id));
  const availableUsers = users.filter(
    u => !existingUserIds.includes(u.id) && !pickedUserIds.has(u.id)
  );

  const pickUser = (userId: string) => {
    setAssignments(current => [...current, { user_id: userId, role: 'team_editor' }]);
  };

  const updateRole = (index: number, role: TeamRole) => {
    setAssignments(current =>
      current.map((a, i) => (i === index ? { ...a, role } : a))
    );
  };

  const removeAssignment = (index: number) => {
    setAssignments(current => current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Add members to ${teamId}`}>
      <div className={styles.dialogBody}>
        {loadingUsers ? (
          <div className={styles.emptyInline}>Loading users…</div>
        ) : (
          <>
            {assignments.map((assignment, index) => {
              const user = users.find(u => u.id === assignment.user_id);
              return (
                <div key={assignment.user_id} className={styles.pickedRow}>
                  <MemberAvatar user={user} size={24} />
                  <div className={styles.pickedName}>
                    {user ? getUserLabel(user) : assignment.user_id}
                  </div>
                  <RoleMenu
                    current={assignment.role}
                    disabled={isSaving}
                    onSelect={role => updateRole(index, role)}
                  />
                  <button
                    type="button"
                    className={styles.removeMemberBtn}
                    style={{ opacity: 1 }}
                    onClick={() => removeAssignment(index)}
                    disabled={isSaving}
                  >
                    <TbTrash size={11} />
                  </button>
                </div>
              );
            })}

            {availableUsers.length > 0 ? (
              <select
                className={styles.select}
                value=""
                onChange={e => {
                  if (e.target.value) pickUser(e.target.value);
                }}
              >
                <option value="">Choose a person to add…</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {getUserLabel(user)}{user.email && user.email !== getUserLabel(user) ? ` (${user.email})` : ''}
                    {!user.is_active ? ' - inactive' : ''}
                  </option>
                ))}
              </select>
            ) : assignments.length === 0 ? (
              <div className={styles.emptyInline}>All workspace users are already in this team.</div>
            ) : null}
          </>
        )}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onSave(assignments)}
            disabled={assignments.length === 0 || isSaving}
          >
            {isSaving ? 'Saving…' : 'Add members'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
