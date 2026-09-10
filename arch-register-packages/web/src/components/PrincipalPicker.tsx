import { useMemo } from 'react';
import { TbX } from 'react-icons/tb';
import { Chip } from './Chip';
import { UserGroupPicker } from './UserGroupPicker';
import { useWorkspaceMembers } from '../hooks/useWorkspaceMembers';
import { useTeams } from '../hooks/useWorkspaceConfig';
import styles from './PrincipalPicker.module.css';

export type PrincipalPickerProps = {
  workspaceSlug: string;
  /** Whether the picker resolves and selects workspace users or teams. */
  kind: 'user' | 'team';
  /** Selected user ids (`kind="user"`) or team ids (`kind="team"`). */
  values: string[];
  onChange: (values: string[]) => void;
  /** Optional cap on how many principals can be selected. */
  maxValues?: number;
};

/**
 * Search-as-you-type multi-select for workspace users or teams, rendering the current selection as
 * removable chips. Used wherever a feature grants something to a set of principals — workflow
 * approvers / escalation targets, application access grants, etc.
 */
export const PrincipalPicker = ({
  workspaceSlug,
  kind,
  values,
  onChange,
  maxValues
}: PrincipalPickerProps) => {
  const { data: members = [] } = useWorkspaceMembers(workspaceSlug);
  const { data: teams = [] } = useTeams(workspaceSlug);
  const labels = useMemo(
    () =>
      new Map(
        kind === 'user'
          ? members.map(member => [member.user_id, member.display_name])
          : teams.map(team => [team.id, team.name])
      ),
    [kind, members, teams]
  );

  return (
    <div className={styles.root}>
      <UserGroupPicker
        kind={kind}
        activeOnly={kind === 'user'}
        excludeIds={values}
        onSelect={item =>
          maxValues !== undefined && values.length >= maxValues
            ? undefined
            : onChange([...values, item.id])
        }
        placeholder={kind === 'user' ? 'Search users to add…' : 'Search teams to add…'}
      />
      {values.length > 0 && (
        <div className={styles.selected}>
          {values.map(id => (
            <Chip key={id}>
              <span>{labels.get(id) ?? id}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${labels.get(id) ?? id}`}
                onClick={() => onChange(values.filter(value => value !== id))}
              >
                <TbX size={10} />
              </button>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
};
