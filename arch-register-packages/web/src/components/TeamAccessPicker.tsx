import { FormElement } from '@diagram-craft/app-components/FormElement';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { PrincipalPicker } from './PrincipalPicker';

/**
 * Team multi-select for a field group's access control. An empty selection
 * means the group is unrestricted (visible/editable to anyone with entity
 * access) — matches today's default behavior.
 */
export const TeamAccessPicker = ({
  teamIds,
  onChange
}: {
  teamIds: string[];
  onChange: (teamIds: string[]) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();

  return (
    <FormElement
      label="Restrict to teams"
      hint="Leave empty for no restriction. Team reviewers can view; team editors and admins can edit."
    >
      <PrincipalPicker
        workspaceSlug={workspaceSlug}
        kind="team"
        values={teamIds}
        onChange={onChange}
      />
    </FormElement>
  );
};
