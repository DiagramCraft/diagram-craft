import { useRef, useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useAutoFocus } from '../../../hooks/useAutoFocus';
import styles from './PlanChangeDialog.module.css';

export type MemberPickerItem = {
  key: string;
  label: string;
  /** Text matched against the search query */
  searchText: string;
};

// Searchable list for adding an entity or relation to a change case.
export const MemberPicker = ({
  items,
  searchPlaceholder,
  emptyText,
  onPick,
  onCancel
}: {
  items: MemberPickerItem[];
  searchPlaceholder: string;
  emptyText: string;
  onPick: (key: string) => void;
  onCancel: () => void;
}) => {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useAutoFocus(searchRef, { enabled: true, delay: 40 });

  const query = search.trim().toLowerCase();
  const matching = query
    ? items.filter(item => item.searchText.toLowerCase().includes(query))
    : items;

  return (
    <div className={styles.addEntityPanel}>
      <div className={styles.addEntitySearch}>
        <TextInput
          ref={searchRef}
          variant="search"
          value={search}
          placeholder={searchPlaceholder}
          onChange={v => setSearch(v ?? '')}
          onClear={() => setSearch('')}
          style={{ width: '100%' }}
        />
      </div>
      <div className={styles.addEntityList}>
        {matching.length === 0 ? (
          <div className={styles.emptyList}>{emptyText}</div>
        ) : (
          matching.map(item => (
            <button
              key={item.key}
              type="button"
              className={styles.addEntityItem}
              onClick={() => onPick(item.key)}
            >
              {item.label}
            </button>
          ))
        )}
      </div>
      <div className={styles.entityPaneFooter}>
        <button type="button" className={styles.addEntityButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};
