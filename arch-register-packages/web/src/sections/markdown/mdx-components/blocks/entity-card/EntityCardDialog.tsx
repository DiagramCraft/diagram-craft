import { useEffect, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../../hooks/useEntities';
import { DEFAULT_FIELDS, filterSchemaFields } from './EntityCard';
import { EntityCardFieldsPicker } from './EntityCardFieldsPicker';
import { EntityPicker } from '../../../../../components/EntityPicker';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import type { EntityCardSlateElement } from './types';

export const EntityCardDialog = ({
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

  const currentEntityId = (element as EntityCardSlateElement).entityId ?? '';
  const currentFields = (element as EntityCardSlateElement).fields ?? '';

  const [selectedEntityId, setSelectedEntityId] = useState(currentEntityId);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    currentFields ? currentFields.split(',').filter(Boolean) : DEFAULT_FIELDS
  );

  const { data: selectedEntity } = useEntity(workspaceSlug, selectedEntityId);
  useEffect(() => {
    if (selectedEntity?._schema?.id) setSelectedSchemaId(selectedEntity._schema.id);
  }, [selectedEntity]);

  const currentSchema = schemas.find(s => s.id === selectedSchemaId);
  const schemaFields = filterSchemaFields(currentSchema?.fields ?? []);

  const toggleField = (fieldId: string) =>
    setSelectedFields(prev =>
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    );

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
        { label: 'Save', type: 'default', disabled: !selectedEntityId, onClick: handleConfirm }
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
            }}
            onClearEntity={() => {
              setSelectedEntityId('');
              setSelectedSchemaId(null);
            }}
          />
        </DialogSection>

        {selectedEntityId && (
          <DialogSection label="Fields">
            <EntityCardFieldsPicker
              schemaFields={schemaFields}
              selectedFields={selectedFields}
              onToggleField={toggleField}
            />
          </DialogSection>
        )}
      </DialogContent>
    </Dialog>
  );
};
