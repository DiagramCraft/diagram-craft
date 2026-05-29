import { type TeamRole } from '@arch-register/permissions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
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

const sameAssignments = (left: EditAssignment[], right: EditAssignment[]) => {
  if (left.length !== right.length) return false;
  return left.every((assignment, index) =>
    assignment.user_id === right[index]?.user_id && assignment.role === right[index]?.role
  );
};

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
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const teamDrafts = useMemo(() => buildTeamDrafts(teams, assignments), [assignments, teams]);
  const selectedTeam = useMemo(
    () => teamDrafts.find(team => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teamDrafts]
  );
  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  if (teamsError || assignmentsError) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load teams.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrap}>
        {isLoadingTeams || isLoadingAssignments ? (
          <div className={styles.empty}>Loading teams…</div>
        ) : teamDrafts.length === 0 ? (
          <div className={styles.empty}>No owner teams have been created for this workspace.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Team</th>
                <th>Members</th>
                <th>Assigned roles</th>
              </tr>
            </thead>
            <tbody>
              {teamDrafts.map(team => {
                const teamAssignments = sortAssignments(team.assignments);
                const roleCounts = TEAM_ROLE_OPTIONS
                  .map(role => ({
                    role,
                    count: teamAssignments.filter(assignment => assignment.role === role.value).length,
                  }))
                  .filter(entry => entry.count > 0);

                return (
                  <tr
                    key={team.id}
                    className={styles.clickableRow}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <td className={styles.teamCell}>
                      <div className={styles.teamName}>{team.id}</div>
                      <div className={styles.teamMeta}>
                        {teamAssignments.length === 1 ? '1 assigned user' : `${teamAssignments.length} assigned users`}
                      </div>
                    </td>
                    <td>
                      <div className={styles.assignedUsers}>
                        {teamAssignments.length === 0 ? (
                          <span className={styles.noAssignments}>No users assigned</span>
                        ) : (
                          teamAssignments.map(assignment => {
                            const user = usersById.get(assignment.user_id);
                            return (
                              <Chip key={`${team.id}:${assignment.user_id}`} tone="ghost">
                                {user ? getUserLabel(user) : assignment.user_id}
                              </Chip>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.assignedRoles}>
                        {roleCounts.length === 0 ? (
                          <span className={styles.noAssignments}>No team roles assigned</span>
                        ) : (
                          roleCounts.map(({ role, count }) => (
                            <Chip key={`${team.id}:${role.value}`} tone="ghost" dot={role.tone}>
                              {count} {role.label}
                            </Chip>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <TeamDialog
        key={selectedTeam?.id ?? 'empty'}
        open={selectedTeam != null}
        mode="edit"
        initialTeam={selectedTeam}
        users={users}
        loadingUsers={isLoadingUsers}
        onClose={() => setSelectedTeamId(null)}
        onSave={async draft => {
          if (!selectedTeam) return;
          const nextTeams = teamDrafts.map(team => (team.id === selectedTeam.id ? draft : team));
          await persistTeams(nextTeams, updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
          setSelectedTeamId(draft.id);
        }}
        onDelete={async draft => {
          const nextTeams = teamDrafts.filter(team => team.id !== draft.id);
          await persistTeams(nextTeams, updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
          setSelectedTeamId(null);
        }}
        isSaving={updateTeams.isPending || updateTeamAssignments.isPending}
      />

      <TeamDialog
        open={addDialogOpen}
        mode="create"
        initialTeam={null}
        users={users}
        loadingUsers={isLoadingUsers}
        onClose={onCloseAddDialog}
        onSave={async draft => {
          await persistTeams([...teamDrafts, draft], updateTeams.mutateAsync, updateTeamAssignments.mutateAsync);
          onCloseAddDialog();
        }}
        isSaving={updateTeams.isPending || updateTeamAssignments.isPending}
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
  initialTeam,
  users,
  loadingUsers,
  onClose,
  onSave,
  onDelete,
  isSaving,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initialTeam: TeamDraft | null;
  users: WorkspaceUserInfo[];
  loadingUsers: boolean;
  onClose: () => void;
  onSave: (draft: TeamDraft) => Promise<void>;
  onDelete?: (draft: TeamDraft) => Promise<void>;
  isSaving: boolean;
}) => {
  const [teamId, setTeamId] = useState(initialTeam?.id ?? '');
  const [assignments, setAssignments] = useState<EditAssignment[]>(initialTeam?.assignments ?? []);
  const teamInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTeamId(initialTeam?.id ?? '');
    setAssignments(initialTeam?.assignments ?? []);
    setTimeout(() => teamInputRef.current?.focus(), 0);
  }, [initialTeam, open]);

  if (!open) return null;

  const normalizedInitialId = initialTeam?.id ?? '';
  const normalizedInitialAssignments = initialTeam?.assignments ?? [];
  const normalizedDraftAssignments = sortAssignments(assignments);
  const isDirty =
    teamId.trim() !== normalizedInitialId ||
    !sameAssignments(normalizedDraftAssignments, sortAssignments(normalizedInitialAssignments));

  const addAssignment = () => {
    setAssignments(current => [
      ...current,
      {
        user_id: users[0]?.id ?? '',
        role: 'team_admin',
      },
    ]);
  };

  const updateAssignment = (index: number, patch: Partial<EditAssignment>) => {
    setAssignments(current =>
      current.map((assignment, assignmentIndex) =>
        assignmentIndex === index ? { ...assignment, ...patch } : assignment
      )
    );
  };

  const removeAssignment = (index: number) => {
    setAssignments(current => current.filter((_, assignmentIndex) => assignmentIndex !== index));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Add team' : `Team: ${initialTeam?.id ?? ''}`}
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Team id</div>
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

        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Team members</div>
            <div className={styles.fieldHint}>Assign existing workspace users a role in this team.</div>
          </div>
          <div className={styles.fieldRight}>
            <div className={styles.assignmentList}>
              {loadingUsers ? (
                <div className={styles.emptyInline}>Loading users…</div>
              ) : users.length === 0 ? (
                <div className={styles.emptyInline}>No workspace users are available yet.</div>
              ) : assignments.length === 0 ? (
                <div className={styles.emptyInline}>No users assigned to this team yet.</div>
              ) : (
                assignments.map((assignment, index) => (
                  <div key={`${assignment.user_id}:${index}`} className={styles.assignmentRow}>
                    <select
                      className={styles.select}
                      value={assignment.user_id}
                      onChange={event => updateAssignment(index, { user_id: event.target.value })}
                    >
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {getUserLabel(user)}{user.email && user.email !== getUserLabel(user) ? ` (${user.email})` : ''}
                          {!user.is_active ? ' - inactive' : ''}
                        </option>
                      ))}
                    </select>
                    <select
                      className={styles.select}
                      value={assignment.role}
                      onChange={event => updateAssignment(index, { role: event.target.value as TeamRole })}
                    >
                      {TEAM_ROLE_OPTIONS.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => removeAssignment(index)}
                      disabled={isSaving}
                    >
                      <TbTrash size={12} />
                    </button>
                  </div>
                ))
              )}

              {!loadingUsers && users.length > 0 && (
                <button type="button" className={styles.btn} onClick={addAssignment} disabled={isSaving}>
                  <TbPlus size={12} /> Add user
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.roleLegend}>
          {TEAM_ROLE_OPTIONS.map(role => (
            <div key={role.value} className={styles.roleLegendItem}>
              <Chip tone="ghost" dot={role.tone}>
                {role.label}
              </Chip>
              <span className={styles.roleLegendText}>{role.description}</span>
            </div>
          ))}
        </div>

        <div className={styles.dialogActions}>
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => void onDelete({ id: teamId.trim(), assignments: normalizedDraftAssignments })}
              disabled={isSaving}
            >
              Delete team
            </button>
          )}
          <button type="button" className={styles.btn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onSave({ id: teamId.trim(), assignments: normalizedDraftAssignments })}
            disabled={!teamId.trim() || !isDirty || isSaving}
          >
            {isSaving ? 'Saving…' : mode === 'create' ? 'Add team' : 'Save team'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
