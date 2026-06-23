import { useEffect, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../hooks/useEntities';
import { STANDARD_FIELD_OPTIONS, STANDARD_FIELD_IDS } from '../../blocks/entity-card/EntityCard';
import { EntityPicker } from '../../../../components/EntityPicker';
import { DialogContent, DialogSection } from '../../BlockDialog';
import type { EntityFieldSlateElement } from './types';
import styles from './EntityFieldDialog.module.css';

export const EntityFieldDialog = ({
  element,
  open,
  onClose,
  isNew
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

  const [selectedEntityId, setSelectedEntityId] = useState(currentEntityId);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState(currentField);

  const { data: selectedEntity } = useEntity(workspaceSlug, selectedEntityId);
  useEffect(() => {
    if (selectedEntity?._schema?.id) setSelectedSchemaId(selectedEntity._schema.id);
  }, [selectedEntity]);

  const currentSchema = schemas.find(s => s.id === selectedSchemaId);
  const schemaFields =
    currentSchema?.fields?.filter(f => f.type !== 'containment' && f.type !== 'reference') ?? [];

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!selectedEntityId || !selectedField || !path) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }
    editor.tf.setNodes({ entityId: selectedEntityId, field: selectedField }, { at: path });
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
      title="Field embed"
      width={400}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        {
          label: 'Save',
          type: 'default',
          disabled: !selectedEntityId || !selectedField,
          onClick: handleConfirm
        }
      ]}
    >
      <DialogContent>
        <DialogSection label="Entity">
          <EntityPicker
            selectedEntityId={selectedEntityId}
            selectedEntity={selectedEntity}
            onSelectEntity={entity => {
              setSelectedEntityId(entity._publicId);
              setSelectedSchemaId(entity._schema?.id ?? null);
              setSelectedField('');
            }}
            onClearEntity={() => {
              setSelectedEntityId('');
              setSelectedSchemaId(null);
              setSelectedField('');
            }}
          />
        </DialogSection>

        {selectedEntityId && (
          <DialogSection label="Field">
            <div className={styles.fieldList}>
              {STANDARD_FIELD_OPTIONS.map(opt => (
                <label
                  key={opt.id}
                  className={`${styles.fieldOption} ${selectedField === opt.id ? styles.fieldOptionSelected : ''}`}
                >
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
          </DialogSection>
        )}
      </DialogContent>
    </Dialog>
  );
};
