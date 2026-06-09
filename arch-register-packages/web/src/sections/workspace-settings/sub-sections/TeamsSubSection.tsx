import { type TeamRole } from '@arch-register/permissions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TbChevronRight, TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Chip } from '../../../components/Chip';
import { ColorPicker } from '../../../components/ColorPicker';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { MemberAvatar, stableHue } from '../../../components/MemberAvatar';
import { getUserLabel } from '../../../utils/userLabel';
import type { TeamAssignmentInfo, WorkspaceTeam, WorkspaceUserInfo } from '../../../lib/api';
import { useWorkspaceUsers } from '../../../hooks/useWorkspaceMembers';
import {
  useTeamAssignments,
  useTeams,
  useUpdateTeamAssignments,
  useUpdateTeams
} from '../../../hooks/useWorkspaceConfig';
import styles from './TeamsSubSection.module.css';

type TeamDraft = {
  id: string;
  name: string;
  color?: string | null;
  description?: string;
  assignments: EditAssignment[];
};

type EditAssignment = {
  user_id: string;
  role: TeamRole;
};

const TEAM_ROLE_OPTIONS: Array<{
  value: TeamRole;
  label: string;
  tone: string;
  description: string;
}> = [
  {
    value: 'team_admin',
    label: 'Team admin',
    tone: 'var(--error-fg)',
    description: 'Full owner-team access plus team administration.'
  },
  {
    value: 'team_editor',
    label: 'Team editor',
    tone: 'var(--accent-fg)',
    description: 'Can edit owned entities and projects.'
  },
  {
    value: 'team_reviewer',
    label: 'Team reviewer',
    tone: 'var(--green)',
    description: 'Read-only access across owned content.'
  }
];

const sortAssignments = (assignments: EditAssignment[]) =>
  [...assignments].sort((left, right) => {
    const userCompare = left.user_id.localeCompare(right.user_id);
    return userCompare !== 0 ? userCompare : left.role.localeCompare(right.role);
  });

const buildTeamDrafts = (teams: WorkspaceTeam[], assignments: TeamAssignmentInfo[]): TeamDraft[] =>
  teams.map(team => ({
    id: team.id,
    name: team.name,
    color: team.color,
    description: team.description,
    assignments: sortAssignments(
      assignments
        .filter(assignment => assignment.team_id === team.id)
        .map(assignment => ({ user_id: assignment.user_id, role: assignment.role }))
    )
  }));

const toOwnerPayload = (teams: TeamDraft[]): WorkspaceTeam[] =>
  teams.map((team, index) => ({
    id: team.id,
    name: team.name.trim(),
    sort_order: index,
    color: team.color ?? null,
    description: team.description ?? ''
  }));

const toMembershipPayload = (teams: TeamDraft[]) =>
  teams.flatMap(team =>
    team.assignments
      .filter(assignment => team.id.length > 0 && assignment.user_id.trim().length > 0)
      .map(assignment => ({
        team_id: team.id.trim(),
        user_id: assignment.user_id,
        role: assignment.role
      }))
  );

const getRoleOption = (role: TeamRole) => TEAM_ROLE_OPTIONS.find(r => r.value === role);

const RoleMenu = ({
  current,
  disabled,
  onSelect
}: {
  current: TeamRole;
  disabled: boolean;
  onSelect: (role: TeamRole) => void;
}) => {
  const roleOpt = getRoleOption(current);

  if (disabled || !roleOpt) {
    return roleOpt ? (
      <Chip tone="ghost" dot={roleOpt.tone}>
        {roleOpt.label}
      </Chip>
    ) : null;
  }

  return (
    <DropdownMenu
      trigger={
        <button type="button" className={styles.roleBtn}>
          <Chip tone="ghost" dot={roleOpt.tone}>
            {roleOpt.label}
          </Chip>
        </button>
      }
      items={TEAM_ROLE_OPTIONS.map(role => ({
        label: role.label,
        icon: <span className={styles.roleMenuDot} style={{ background: role.tone }} />,
        onClick: () => onSelect(role.value)
      }))}
    />
  );
};

export const TeamsSubSection = ({
  workspaceSlug,
  addDialogOpen,
  onCloseAddDialog
}: {
  workspaceSlug: string;
  addDialogOpen: boolean;
  onCloseAddDialog: () => void;
}) => {
  const {
    data: teams = [],
    isLoading: isLoadingTeams,
    error: teamsError
  } = useTeams(workspaceSlug);
  const {
    data: assignments = [],
    isLoading: isLoadingAssignments,
    error: assignmentsError
  } = useTeamAssignments(workspaceSlug);
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
            )
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
              <div
                key={team.id}
                className={`${styles.teamCard} ${isOpen ? styles.teamCardOpen : ''}`}
              >
                <button
                  type="button"
                  className={styles.teamCardHead}
                  onClick={() => setOpenId(isOpen ? null : team.id)}
                >
                  <span
                    className={styles.teamColorBar}
                    style={{ background: team.color ?? `oklch(0.65 0.15 ${stableHue(team.id)})` }}
                  />
                  <div className={styles.teamNameSection}>
                    <span className={styles.teamName}>{team.name}</span>
                  </div>
                  {team.description && (
                    <span className={styles.teamDescription}>{team.description}</span>
                  )}
                  <span className={styles.teamLeadRow}>
                    {leadUser && (
                      <>
                        <span className={styles.dim}>Lead</span>
                        <MemberAvatar
                          name={leadUser.display_name}
                          email={leadUser.email}
                          userId={leadUser.id}
                          color={leadUser.color ?? null}
                          size={18}
                        />
                        <span>{getUserLabel(leadUser)}</span>
                      </>
                    )}
                  </span>
                  <span className={styles.teamCount}>{teamAssignments.length}</span>
                  <span className={styles.teamAvatars}>
                    {teamAssignments.slice(0, 4).map(a => {
                      const u = usersById.get(a.user_id);
                      return u ? (
                        <MemberAvatar
                          key={a.user_id}
                          name={u.display_name}
                          email={u.email}
                          userId={u.id}
                          color={u.color ?? null}
                          size={20}
                        />
                      ) : null;
                    })}
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
                      <Button
                        variant="ghost"
                        icon={<TbEdit size={11} />}
                        onClick={() => setEditTeamId(team.id)}
                      >
                        Edit team
                      </Button>
                      <Button
                        variant="ghost"
                        icon={<TbPlus size={11} />}
                        onClick={() => setAddMembersTeamId(team.id)}
                      >
                        Add members
                      </Button>
                      <div style={{ flex: 1 }} />
                      <span className={styles.dim}>
                        {teamAssignments.length}{' '}
                        {teamAssignments.length === 1 ? 'member' : 'members'}
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
                              <MemberAvatar
                                name={user?.display_name ?? ''}
                                email={user?.email ?? null}
                                userId={a.user_id}
                                color={user?.color ?? null}
                                size={24}
                              />
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
        initialTeamName={editTeam?.name ?? ''}
        initialColor={editTeam?.color}
        initialDescription={editTeam?.description}
        onClose={() => setEditTeamId(null)}
        onSave={async (name, color, description) => {
          if (!editTeam) return;
          const updatedTeam = { ...editTeam, name, color, description };
          const nextTeams = teamDrafts.map(team => (team.id === editTeam.id ? updatedTeam : team));
          await persistTeams(nextTeams, updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
          setEditTeamId(null);
        }}
        isSaving={isSaving}
      />

      <TeamDialog
        open={addDialogOpen}
        mode="create"
        initialTeamName=""
        initialColor={null}
        initialDescription=""
        onClose={onCloseAddDialog}
        onSave={async (name, color, description) => {
          await persistTeams(
            [...teamDrafts, { id: crypto.randomUUID(), name, color, description, assignments: [] }],
            updateTeams.mutateAsync,
            updateTeamAssignments.mutateAsync
          );
          onCloseAddDialog();
        }}
        isSaving={isSaving}
      />

      <AddMembersDialog
        open={addMembersTeam != null}
        teamName={addMembersTeam?.name ?? ''}
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
  saveOwners: (owners: WorkspaceTeam[]) => Promise<unknown>,
  saveMemberships: (
    memberships: Array<{ team_id: string; user_id: string; role: TeamRole }>
  ) => Promise<unknown>
) => {
  const cleanTeams = teams
    .map(team => ({ ...team, name: team.name.trim() }))
    .filter(team => team.name.length > 0);
  await saveOwners(toOwnerPayload(cleanTeams));
  await saveMemberships(toMembershipPayload(cleanTeams));
};

const TeamDialog = ({
  open,
  mode,
  initialTeamName,
  initialColor,
  initialDescription,
  onClose,
  onSave,
  isSaving
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initialTeamName: string;
  initialColor?: string | null;
  initialDescription?: string;
  onClose: () => void;
  onSave: (name: string, color: string | null, description: string) => Promise<void>;
  isSaving: boolean;
}) => {
  const [teamName, setTeamName] = useState(initialTeamName);
  const [color, setColor] = useState<string | null>(initialColor ?? null);
  const [description, setDescription] = useState(initialDescription ?? '');
  const teamInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTeamName(initialTeamName);
    setColor(initialColor ?? null);
    setDescription(initialDescription ?? '');
    setTimeout(() => teamInputRef.current?.focus(), 0);
  }, [initialTeamName, initialColor, initialDescription, open]);

  if (!open) return null;

  const isDirty =
    teamName.trim() !== initialTeamName || color !== initialColor || description !== initialDescription;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Add team' : 'Edit team'}
      buttons={[
        { label: 'Cancel', type: 'cancel', disabled: isSaving, onClick: onClose },
        {
          label: isSaving ? 'Saving…' : mode === 'create' ? 'Add team' : 'Save team',
          type: 'default',
          disabled: !teamName.trim() || !isDirty || isSaving,
          onClick: () => {
            void onSave(teamName.trim(), color, description);
          }
        }
      ]}
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Name</div>
            <div className={styles.fieldHint}>
              Used as the owner value for entities and projects.
            </div>
          </div>
          <div className={styles.fieldRight}>
            <TextInput
              ref={teamInputRef}
              value={teamName}
              onChange={value => setTeamName(value ?? '')}
              placeholder="Platform Engineering"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Description</div>
            <div className={styles.fieldHint}>
              Brief description of the team's responsibilities.
            </div>
          </div>
          <div className={styles.fieldRight}>
            <TextArea
              value={description}
              onChange={value => setDescription(value ?? '')}
              placeholder="Responsible for..."
              rows={3}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Color</div>
            <div className={styles.fieldHint}>Visual identifier for the team.</div>
          </div>
          <div className={styles.fieldRight}>
            <ColorPicker value={color} onChange={setColor} disabled={isSaving} size="small" />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

const AddMembersDialog = ({
  open,
  teamName,
  existingUserIds,
  users,
  loadingUsers,
  onClose,
  onSave,
  isSaving
}: {
  open: boolean;
  teamName: string;
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
    setAssignments(current => current.map((a, i) => (i === index ? { ...a, role } : a)));
  };

  const removeAssignment = (index: number) => {
    setAssignments(current => current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Add members to ${teamName}`}>
      <div className={styles.dialogBody}>
        {loadingUsers ? (
          <div className={styles.emptyInline}>Loading users…</div>
        ) : (
          <>
            {assignments.map((assignment, index) => {
              const user = users.find(u => u.id === assignment.user_id);
              return (
                <div key={assignment.user_id} className={styles.pickedRow}>
                  <MemberAvatar
                    name={user?.display_name ?? ''}
                    email={user?.email ?? null}
                    userId={assignment.user_id}
                    color={user?.color ?? null}
                    size={24}
                  />
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
              <Select.Root
                value={undefined}
                onChange={value => {
                  if (value) pickUser(value);
                }}
                placeholder="Choose a person to add…"
                style={{ width: '100%' }}
              >
                {availableUsers.map(user => (
                  <Select.Item key={user.id} value={user.id}>
                    {getUserLabel(user)}
                    {user.email && user.email !== getUserLabel(user) ? ` (${user.email})` : ''}
                    {!user.is_active ? ' - inactive' : ''}
                  </Select.Item>
                ))}
              </Select.Root>
            ) : assignments.length === 0 ? (
              <div className={styles.emptyInline}>
                All workspace users are already in this team.
              </div>
            ) : null}
          </>
        )}

        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSave(assignments)}
            disabled={assignments.length === 0 || isSaving}
          >
            {isSaving ? 'Saving…' : 'Add members'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
