import { useEffect, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import { useEntities, useEntity } from '../../../../hooks/useEntities';
import { STANDARD_FIELD_OPTIONS, STANDARD_FIELD_IDS } from '../../blocks/entity-card/EntityCardBlock';
import type { EntityFieldSlateElement } from './types';
import styles from './EntityFieldEditor.module.css';

export const EntityFieldDialog = ({
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

  const currentEntityId = (element as EntityFieldSlateElement).entityId ?? '';
  const currentField = (element as EntityFieldSlateElement).field ?? '';

  const [query, setQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState(currentEntityId);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState(currentField);

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

  const handleSelectEntity = (entity: { _publicId: string; _schema?: { id: string } | null }) => {
    setSelectedEntityId(entity._publicId);
    setSelectedSchemaId(entity._schema?.id ?? null);
    setSelectedField('');
    setQuery('');
  };

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!selectedEntityId || !selectedField || !path) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }
    editor.tf.setNodes(
      { entityId: selectedEntityId, field: selectedField },
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

  const canSave = !!selectedEntityId && !!selectedField;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Field embed"
      width={400}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm },
      ]}
    >
      <div className={styles.dialogContent}>
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Entity</div>
          {selectedEntityId && selectedEntity && !query && (
            <div className={styles.selectedChip}>
              <span className={styles.pickerName}>{selectedEntity._name}</span>
              <span className={styles.pickerSchema}>{selectedEntity._schema?.name}</span>
              <button
                type="button"
                className={styles.chipClear}
                onClick={() => { setSelectedEntityId(''); setSelectedSchemaId(null); setSelectedField(''); }}
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
                    onClick={() => handleSelectEntity(entity)}
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
        </div>

        {selectedEntityId && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Field</div>
            <div className={styles.fieldList}>
              {STANDARD_FIELD_OPTIONS.map(opt => (
                <label key={opt.id} className={`${styles.fieldOption} ${selectedField === opt.id ? styles.fieldOptionSelected : ''}`}>
                  <input
                    type="radio"
                    name="field"
                    value={opt.id}
                    checked={selectedField === opt.id}
                    onChange={() => setSelectedField(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
              {schemaFields.map(field => (
                <label
                  key={field.id}
                  className={`${styles.fieldOption} ${STANDARD_FIELD_IDS.has(field.id) ? '' : styles.fieldOptionSchema} ${selectedField === field.id ? styles.fieldOptionSelected : ''}`}
                >
                  <input
                    type="radio"
                    name="field"
                    value={field.id}
                    checked={selectedField === field.id}
                    onChange={() => setSelectedField(field.id)}
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
