import { useMemo } from 'react';
import { TbX } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { UserGroupPicker } from '../../../components/UserGroupPicker';
import { useWorkspaceMembers } from '../../../hooks/useWorkspaceMembers';
import { useTeams } from '../../../hooks/useWorkspaceConfig';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowFallbackTargetPickerProps = {
  workspaceSlug: string;
  kind: 'user' | 'team';
  values: string[];
  onChange: (values: string[]) => void;
  maxValues?: number;
};

export const WorkflowFallbackTargetPicker = ({
  workspaceSlug,
  kind,
  values,
  onChange,
  maxValues
}: WorkflowFallbackTargetPickerProps) => {
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
    <div className={styles.fallbackPicker}>
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
        <div className={styles.selectedValues}>
          {values.map(id => (
            <Chip key={id}>
              <span>{labels.get(id) ?? id}</span>
              <button
                type="button"
                className={styles.removeValue}
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
