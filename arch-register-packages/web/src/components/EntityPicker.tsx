import { useState } from 'react';
import { Autocomplete } from '@diagram-craft/app-components/Autocomplete';
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
  onClearEntity
}: {
  selectedEntityId: string;
  selectedEntity?: { _name: string; _schema?: { name?: string } | null } | null;
  onSelectEntity: (entity: EntitySearchResult) => void;
  onClearEntity: () => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [query, setQuery] = useState('');

  const {
    data: searchResults = [],
    isLoading,
    isError
  } = useEntities(
    workspaceSlug,
    {
      q: query.trim() || undefined,
      view: 'summary',
      limit: 8
    },
    { enabled: !!query.trim() }
  );

  return (
    <>
      {selectedEntityId && selectedEntity && !query && (
        <div className={styles.selectedChip}>
          <span className={styles.pickerName}>{selectedEntity._name}</span>
          <span className={styles.pickerSchema}>{selectedEntity._schema?.name}</span>
          <button type="button" className={styles.chipClear} onClick={onClearEntity}>
            ×
          </button>
        </div>
      )}
      <Autocomplete
        items={searchResults}
        value={query}
        onValueChange={setQuery}
        onSelect={entity => {
          onSelectEntity(entity);
          setQuery('');
        }}
        getItemKey={entity => entity._publicId}
        getItemLabel={entity => entity._name}
        placeholder={selectedEntityId ? 'Search to change entity…' : 'Search for an entity…'}
        ariaLabel={selectedEntityId ? 'Search to change entity' : 'Search for an entity'}
        emptyMessage="No entities found"
        loading={!!query.trim() && isLoading}
        errorMessage={query.trim() && isError ? 'Unable to search entities' : undefined}
        autoFocus
        inputClassName={styles.pickerInput}
        renderItem={entity => (
          <>
            <span className={styles.pickerName}>{entity._name}</span>
            <span className={styles.pickerSchema}>{entity._schema?.name}</span>
          </>
        )}
      />
    </>
  );
};
