import { useState } from 'react';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { Autocomplete } from '@diagram-craft/app-components/Autocomplete';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useRelations } from '../hooks/useRelations';
import styles from './EntityPicker.module.css';

export const RelationPicker = ({
  selectedRelationId,
  selectedRelation,
  onSelectRelation,
  onClearRelation,
  enabled = true
}: {
  selectedRelationId: string;
  selectedRelation?: RelationRecord | null;
  onSelectRelation: (relation: RelationRecord) => void;
  onClearRelation: () => void;
  enabled?: boolean;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [query, setQuery] = useState('');
  const {
    data: relations,
    isLoading,
    isError
  } = useRelations(workspaceSlug, { limit: 500 }, { enabled });

  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? relations
        .filter(relation =>
          [relation._schema.name, relation._in.name, relation._out.name].some(value =>
            value.toLowerCase().includes(normalizedQuery)
          )
        )
        .slice(0, 8)
    : [];

  return (
    <>
      {selectedRelationId && selectedRelation && !query && (
        <div className={styles.selectedChip}>
          <span className={styles.pickerName}>
            {selectedRelation._in.name} → {selectedRelation._out.name}
          </span>
          <span className={styles.pickerSchema}>{selectedRelation._schema.name}</span>
          <button type="button" className={styles.chipClear} onClick={onClearRelation}>
            ×
          </button>
        </div>
      )}
      <Autocomplete
        items={searchResults}
        value={query}
        onValueChange={setQuery}
        onSelect={relation => {
          onSelectRelation(relation);
          setQuery('');
        }}
        getItemKey={relation => relation._uid}
        getItemLabel={relation => `${relation._in.name} → ${relation._out.name}`}
        placeholder={selectedRelationId ? 'Search to change relation…' : 'Search for a relation…'}
        ariaLabel={selectedRelationId ? 'Search to change relation' : 'Search for a relation'}
        emptyMessage={relations.length === 0 ? 'No relations found' : 'No matching relations found'}
        loading={isLoading}
        errorMessage={isError ? 'Unable to search relations' : undefined}
        autoFocus
        inputClassName={styles.pickerInput}
        renderItem={relation => (
          <>
            <span className={styles.pickerName}>
              {relation._in.name} → {relation._out.name}
            </span>
            <span className={styles.pickerSchema}>{relation._schema.name}</span>
          </>
        )}
      />
    </>
  );
};
