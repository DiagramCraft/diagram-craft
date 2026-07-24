import { useMemo, useState } from 'react';
import { Autocomplete } from '@diagram-craft/app-components/Autocomplete';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useWorkspaceUsers } from '../hooks/useWorkspaceMembers';
import { useTeams } from '../hooks/useWorkspaceConfig';
import { MemberAvatar, stableHue } from './MemberAvatar';
import styles from './UserGroupPicker.module.css';

export type UserGroupPickerItem = {
  id: string;
  kind: 'user' | 'team';
  label: string;
  email?: string | null;
  color?: string | null;
};

export const UserGroupPicker = ({
  kind,
  excludeIds,
  onSelect,
  placeholder = 'Search to add…',
  activeOnly = false,
  limit = 50
}: {
  kind: UserGroupPickerItem['kind'];
  excludeIds?: string[];
  onSelect: (item: UserGroupPickerItem) => void;
  placeholder?: string;
  activeOnly?: boolean;
  limit?: number;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();
  const enabled = trimmedQuery.length > 0;
  const searchOptions = { q: trimmedQuery, limit };
  const usersQuery = useWorkspaceUsers(workspaceSlug, enabled && kind === 'user', searchOptions);
  const teamsQuery = useTeams(workspaceSlug, enabled && kind === 'team', searchOptions);

  const items = useMemo<UserGroupPickerItem[]>(() => {
    if (kind === 'user') {
      return (usersQuery.data ?? [])
        .filter(user => !activeOnly || user.is_active)
        .map(user => ({
          id: user.id,
          kind: 'user',
          label: `${user.display_name}${!user.is_active && !activeOnly ? ' - inactive' : ''}`,
          email: user.email,
          color: user.color
        }));
    }

    return (teamsQuery.data ?? []).map(team => ({
      id: team.id,
      kind: 'team',
      label: team.name,
      color: team.color
    }));
  }, [activeOnly, kind, teamsQuery.data, usersQuery.data]);

  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const visibleItems = useMemo(
    () => items.filter(item => !excluded.has(item.id)),
    [excluded, items]
  );
  const isLoading = kind === 'user' ? usersQuery.isLoading : teamsQuery.isLoading;
  const isError = kind === 'user' ? usersQuery.isError : teamsQuery.isError;

  return (
    <Autocomplete
      items={visibleItems}
      value={query}
      onValueChange={setQuery}
      onSelect={item => {
        onSelect(item);
        setQuery('');
      }}
      getItemKey={item => item.id}
      getItemLabel={item => item.label}
      placeholder={placeholder}
      ariaLabel={placeholder}
      emptyMessage="No matches found"
      loading={enabled && isLoading}
      errorMessage={enabled && isError ? 'Unable to search right now' : undefined}
      inputClassName={styles.pickerInput}
      renderItem={item => (
        <>
          {item.kind === 'user' ? (
            <MemberAvatar
              name={item.label}
              email={item.email ?? null}
              userId={item.id}
              color={item.color ?? null}
              size={20}
              hideTooltip
            />
          ) : (
            <span
              className={styles.teamDot}
              style={{ background: item.color ?? `oklch(0.65 0.15 ${stableHue(item.id)})` }}
            />
          )}
          <span className={styles.pickerName}>{item.label}</span>
          {item.kind === 'user' && item.email && (
            <span className={styles.pickerEmail}>{item.email}</span>
          )}
        </>
      )}
    />
  );
};
