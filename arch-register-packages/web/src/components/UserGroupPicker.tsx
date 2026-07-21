import { useState } from 'react';
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
  items,
  excludeIds,
  onSelect,
  placeholder = 'Search to add…',
  limit = 50
}: {
  items: UserGroupPickerItem[];
  excludeIds?: string[];
  onSelect: (item: UserGroupPickerItem) => void;
  placeholder?: string;
  limit?: number;
}) => {
  const [query, setQuery] = useState('');

  const excluded = new Set(excludeIds ?? []);
  const trimmed = query.trim().toLowerCase();
  const results = items
    .filter(item => !excluded.has(item.id))
    .filter(
      item =>
        !trimmed ||
        item.label.toLowerCase().includes(trimmed) ||
        (item.email ?? '').toLowerCase().includes(trimmed)
    )
    .slice(0, limit);

  return (
    <>
      <input
        type="text"
        className={styles.pickerInput}
        placeholder={placeholder}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {query &&
        (results.length > 0 ? (
          <div className={styles.pickerResults}>
            {results.map(item => (
              <button
                key={item.id}
                type="button"
                className={styles.pickerItem}
                onClick={() => {
                  onSelect(item);
                  setQuery('');
                }}
              >
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
                    style={{ background: `oklch(0.65 0.15 ${stableHue(item.id)})` }}
                  />
                )}
                <span className={styles.pickerName}>{item.label}</span>
                {item.kind === 'user' && item.email && (
                  <span className={styles.pickerEmail}>{item.email}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.pickerHint}>No matches found</div>
        ))}
    </>
  );
};
