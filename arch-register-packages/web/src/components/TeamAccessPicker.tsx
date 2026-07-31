import { useMemo } from 'react';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { UserGroupPicker } from './UserGroupPicker';
import { stableHue } from './MemberAvatar';
import styles from './GroupsEditor.module.css';

export type TeamAccessPickerTeam = { id: string; name: string };

/**
 * Team multi-select for a field group's access control. An empty selection
 * means the group is unrestricted (visible/editable to anyone with entity
 * access) — matches today's default behavior.
 */
export const TeamAccessPicker = ({
  teams,
  teamIds,
  onChange
}: {
  teams: TeamAccessPickerTeam[];
  teamIds: string[];
  onChange: (teamIds: string[]) => void;
}) => {
  const teamsById = useMemo(() => new Map(teams.map(team => [team.id, team])), [teams]);

  return (
    <FormElement
      label="Restrict to teams"
      hint="Leave empty for no restriction. Team reviewers can view; team editors and admins can edit."
    >
      {teamIds.length > 0 && (
        <div className={styles.pickedList}>
          {teamIds.map(teamId => (
            <span key={teamId} className={styles.pickedChip}>
              <span
                className={styles.teamDot}
                style={{ background: `oklch(0.65 0.15 ${stableHue(teamId)})` }}
              />
              {teamsById.get(teamId)?.name ?? 'Unavailable team'}
              <button
                type="button"
                className={styles.pickedRemove}
                title="Remove team"
                onClick={() => onChange(teamIds.filter(id => id !== teamId))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <UserGroupPicker
        kind="team"
        excludeIds={teamIds}
        onSelect={item => onChange([...teamIds, item.id])}
        placeholder="Search teams to add…"
      />
    </FormElement>
  );
};
