import { useEffect, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import { useEntities, useEntity } from '../../../../hooks/useEntities';
import { STANDARD_FIELD_OPTIONS, DEFAULT_FIELDS, STANDARD_FIELD_IDS } from './EntityCardBlock';
import type { EntityCardSlateElement } from './types';
import styles from './EntityCardEditor.module.css';

export const EntityCardDialog = ({
  element,
  open,
  onClose,
  isNew,
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const { workspaceSlug, schemas } = useWorkspaceContext();

  const currentEntityId = (element as EntityCardSlateElement).entityId ?? '';
  const currentFields = (element as EntityCardSlateElement).fields ?? '';

  const [query, setQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState(currentEntityId);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    currentFields ? currentFields.split(',').filter(Boolean) : DEFAULT_FIELDS
  );

  // Hits React Query cache immediately when the card is already rendered on the page
  const { data: selectedEntity } = useEntity(workspaceSlug, selectedEntityId);
  useEffect(() => {
    if (selectedEntity?._schema?.id) setSelectedSchemaId(selectedEntity._schema.id);
  }, [selectedEntity]);

  const { data: searchResults = [] } = useEntities(workspaceSlug, {
    q: query || undefined,
    view: 'summary',
    limit: 8,
  });

  const currentSchema = schemas.find(s => s.id === selectedSchemaId);
  const schemaFields = currentSchema?.fields?.filter(
    f => f.type !== 'containment' && f.type !== 'reference'
  ) ?? [];

  const toggleField = (fieldId: string) =>
    setSelectedFields(prev =>
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    );

  const handleSelectEntity = (entity: { _publicId: string; _schema?: { id: string } | null }) => {
    setSelectedEntityId(entity._publicId);
    setSelectedSchemaId(entity._schema?.id ?? null);
    setQuery('');
  };

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!selectedEntityId || !path) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }
    editor.tf.setNodes(
      { entityId: selectedEntityId, fields: selectedFields.join(',') },
      { at: path }
    );
    onClose();
  };

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Entity card"
      width={440}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !selectedEntityId, onClick: handleConfirm },
      ]}
    >
      <div className={styles.entityCardDialogContent}>
        <div className={styles.entityCardSection}>
          <div className={styles.entityCardSectionLabel}>Entity</div>
          {selectedEntityId && selectedEntity && !query && (
            <div className={styles.entityCardSelectedChip}>
              <span className={styles.entityPickerName}>{selectedEntity._name}</span>
              <span className={styles.entityPickerSchema}>{selectedEntity._schema?.name}</span>
              <button
                type="button"
                className={styles.entityCardChipClear}
                onClick={() => { setSelectedEntityId(''); setSelectedSchemaId(null); }}
              >
                ×
              </button>
            </div>
          )}
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="text"
            className={styles.entityPickerInput}
            placeholder={selectedEntityId ? 'Search to change entity…' : 'Search for an entity…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            searchResults.length > 0 ? (
              <div className={styles.entityPickerResults}>
                {searchResults.map(entity => (
                  <button
                    key={entity._publicId}
                    type="button"
                    className={`${styles.entityPickerItem} ${entity._publicId === selectedEntityId ? styles.entityPickerItemActive : ''}`}
                    onClick={() => handleSelectEntity(entity)}
                  >
                    <span className={styles.entityPickerName}>{entity._name}</span>
                    <span className={styles.entityPickerSchema}>{entity._schema?.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.entityPickerHint}>No entities found</div>
            )
          )}
        </div>

        {selectedEntityId && (
          <div className={styles.entityCardSection}>
            <div className={styles.entityCardSectionLabel}>Fields</div>
            <div className={styles.entityCardFieldGrid}>
              {STANDARD_FIELD_OPTIONS.map(opt => (
                <label key={opt.id} className={styles.entityCardFieldOption}>
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(opt.id)}
                    onChange={() => toggleField(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
              {schemaFields.map(field => (
                <label
                  key={field.id}
                  className={`${styles.entityCardFieldOption} ${STANDARD_FIELD_IDS.has(field.id) ? '' : styles.entityCardFieldOptionSchema}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.id)}
                    onChange={() => toggleField(field.id)}
                  />
                  {field.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
