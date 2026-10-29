import { useMemo } from 'react';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { UserGroupPicker } from './UserGroupPicker';
import { PickedTeamChips } from './PickedTeamChips';

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
      <PickedTeamChips
        ids={teamIds}
        getLabel={id => teamsById.get(id)?.name}
        onRemove={id => onChange(teamIds.filter(item => item !== id))}
        spaced
      />
      <UserGroupPicker
        kind="team"
        excludeIds={teamIds}
        onSelect={item => onChange([...teamIds, item.id])}
        placeholder="Search teams to add…"
      />
    </FormElement>
  );
};
