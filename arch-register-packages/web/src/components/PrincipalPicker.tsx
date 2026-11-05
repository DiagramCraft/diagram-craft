import { useMemo, useState } from 'react';
import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { useWorkspaceMembers, useWorkspaceUsers } from '../hooks/useWorkspaceMembers';
import { useTeams } from '../hooks/useWorkspaceConfig';
import { MemberAvatar, stableHue } from './MemberAvatar';
import styles from './UserGroupPicker.module.css';

export type PrincipalPickerProps = {
  workspaceSlug: string;
  /** Whether the picker resolves and selects workspace users or teams. */
  kind: 'user' | 'team';
  /** Selected user ids (`kind="user"`) or team ids (`kind="team"`). */
  values: string[];
  onChange: (values: string[]) => void;
  /** Optional cap on how many principals can be selected. */
  maxValues?: number;
  disabled?: boolean;
};

type PrincipalItem = MultiSelectItem & { email?: string | null; color?: string | null };

const SEARCH_LIMIT = 50;

/**
 * Search-as-you-type multi-select for workspace users or teams, built on MultiSelect with
 * server-side search. Used wherever a feature grants something to a set of principals — workflow
 * approvers / escalation targets, application access grants, etc.
 */
export const PrincipalPicker = ({
  workspaceSlug,
  kind,
  values,
  onChange,
  maxValues,
  disabled
}: PrincipalPickerProps) => {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const enabled = trimmed.length > 0;
  const searchOptions = { q: trimmed, limit: SEARCH_LIMIT };

  const { data: members = [] } = useWorkspaceMembers(workspaceSlug);
  const { data: teams = [] } = useTeams(workspaceSlug);
  const usersQuery = useWorkspaceUsers(workspaceSlug, enabled && kind === 'user', searchOptions);
  const teamsQuery = useTeams(workspaceSlug, enabled && kind === 'team', searchOptions);

  const selectedItems = useMemo<MultiSelectItem[]>(
    () =>
      kind === 'user'
        ? members.map(m => ({ value: m.user_id, label: m.display_name }))
        : teams.map(t => ({ value: t.id, label: t.name })),
    [kind, members, teams]
  );

  const availableItems = useMemo<PrincipalItem[]>(() => {
    if (!enabled) return [];
    if (kind === 'user') {
      return (usersQuery.data ?? [])
        .filter(user => user.is_active)
        .map(user => ({
          value: user.id,
          label: user.display_name,
          email: user.email,
          color: user.color
        }));
    }
    return (teamsQuery.data ?? []).map(team => ({
      value: team.id,
      label: team.name,
      color: team.color
    }));
  }, [enabled, kind, teamsQuery.data, usersQuery.data]);

  const byValue = useMemo(() => new Map(availableItems.map(i => [i.value, i])), [availableItems]);
  const isLoading = kind === 'user' ? usersQuery.isLoading : teamsQuery.isLoading;
  const isError = kind === 'user' ? usersQuery.isError : teamsQuery.isError;

  return (
    <MultiSelect
      selectedValues={values}
      selectedItems={selectedItems}
      availableItems={availableItems}
      disabled={disabled}
      filterLocally={false}
      maxSuggestions={SEARCH_LIMIT}
      loading={enabled && isLoading}
      emptyMessage={isError ? 'Unable to search right now' : 'No matches found'}
      onInputChange={value => setQuery(value)}
      onSelectionChange={next =>
        onChange(maxValues !== undefined && next.length > maxValues ? values : next)
      }
      placeholder={kind === 'user' ? 'Search users to add…' : 'Search teams to add…'}
      aria-label={kind === 'user' ? 'Search users to add' : 'Search teams to add'}
      renderItem={item => {
        const p = byValue.get(item.value);
        return (
          <>
            {kind === 'user' ? (
              <MemberAvatar
                name={item.label}
                email={p?.email ?? null}
                userId={item.value}
                color={p?.color ?? null}
                size={20}
                hideTooltip
              />
            ) : (
              <span
                className={styles.teamDot}
                style={{ background: p?.color ?? `oklch(0.65 0.15 ${stableHue(item.value)})` }}
              />
            )}
            <span className={styles.pickerName}>{item.label}</span>
            {p?.email && <span className={styles.pickerEmail}>{p.email}</span>}
          </>
        );
      }}
    />
  );
};
