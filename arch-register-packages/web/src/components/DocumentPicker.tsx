import { useState } from 'react';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useDocumentSearch } from '../hooks/useSearch';
import styles from './EntityPicker.module.css';

type DocumentSearchResult = {
  fileId: string;
  name: string;
  scope: 'project' | 'entity' | 'workspace';
  projectName: string | null;
  entityName: string | null;
};

const scopeLabel = (doc: DocumentSearchResult) =>
  doc.scope === 'project' ? doc.projectName : doc.scope === 'entity' ? doc.entityName : 'Workspace';

export const DocumentPicker = ({
  selectedDocumentId,
  selectedDocument,
  onSelectDocument,
  onClearDocument
}: {
  selectedDocumentId: string;
  selectedDocument?: { name: string } | null;
  onSelectDocument: (document: DocumentSearchResult) => void;
  onClearDocument: () => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [query, setQuery] = useState('');

  const { data: searchResults = [] } = useDocumentSearch(workspaceSlug, query);

  return (
    <>
      {selectedDocumentId && selectedDocument && !query && (
        <div className={styles.selectedChip}>
          <span className={styles.pickerName}>{selectedDocument.name}</span>
          <button type="button" className={styles.chipClear} onClick={onClearDocument}>
            ×
          </button>
        </div>
      )}
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        type="text"
        className={styles.pickerInput}
        placeholder={selectedDocumentId ? 'Search to change document…' : 'Search for a document…'}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {query &&
        (searchResults.length > 0 ? (
          <div className={styles.pickerResults}>
            {searchResults.map(doc => (
              <button
                key={doc.fileId}
                type="button"
                className={`${styles.pickerItem} ${doc.fileId === selectedDocumentId ? styles.pickerItemActive : ''}`}
                onClick={() => {
                  onSelectDocument(doc);
                  setQuery('');
                }}
              >
                <span className={styles.pickerName}>{doc.name}</span>
                <span className={styles.pickerSchema}>{scopeLabel(doc)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.pickerHint}>No documents found</div>
        ))}
    </>
  );
};
