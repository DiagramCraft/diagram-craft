import { useState } from 'react';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useEntities } from '../hooks/useEntities';
import styles from './EntityPicker.module.css';

type EntitySearchResult = {
  _publicId: string;
  _name: string;
  _schema?: { id: string; name?: string } | null;
};

export const EntityPicker = ({
  selectedEntityId,
  selectedEntity,
  onSelectEntity,
  onClearEntity,
}: {
  selectedEntityId: string;
  selectedEntity?: { _name: string; _schema?: { name?: string } | null } | null;
  onSelectEntity: (entity: EntitySearchResult) => void;
  onClearEntity: () => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [query, setQuery] = useState('');

  const { data: searchResults = [] } = useEntities(workspaceSlug, {
    q: query || undefined,
    view: 'summary',
    limit: 8,
  });

  return (
    <>
      {selectedEntityId && selectedEntity && !query && (
        <div className={styles.selectedChip}>
          <span className={styles.pickerName}>{selectedEntity._name}</span>
          <span className={styles.pickerSchema}>{selectedEntity._schema?.name}</span>
          <button
            type="button"
            className={styles.chipClear}
            onClick={onClearEntity}
          >
            ×
          </button>
        </div>
      )}
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        type="text"
        className={styles.pickerInput}
        placeholder={selectedEntityId ? 'Search to change entity…' : 'Search for an entity…'}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {query && (
        searchResults.length > 0 ? (
          <div className={styles.pickerResults}>
            {searchResults.map(entity => (
              <button
                key={entity._publicId}
                type="button"
                className={`${styles.pickerItem} ${entity._publicId === selectedEntityId ? styles.pickerItemActive : ''}`}
                onClick={() => { onSelectEntity(entity); setQuery(''); }}
              >
                <span className={styles.pickerName}>{entity._name}</span>
                <span className={styles.pickerSchema}>{entity._schema?.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.pickerHint}>No entities found</div>
        )
      )}
    </>
  );
};
