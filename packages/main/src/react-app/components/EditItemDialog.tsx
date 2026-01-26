import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Data } from '@diagram-craft/model/dataProvider';
import {
  decodeDataReferences,
  encodeDataReferences
} from '@diagram-craft/model/diagramDocumentDataSchemas';
import { newid } from '@diagram-craft/utils/id';
import { assert } from '@diagram-craft/utils/assert';
import React, { useState } from 'react';
import { useDiagram, useDocument } from '../../application';
import { DataManagerUndoableFacade } from '@diagram-craft/model/diagramDocumentDataUndoActions';
import { ReferenceFieldEditor } from './ReferenceFieldEditor';
import { Select } from '@diagram-craft/app-components/Select';

type EditItemDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedSchema: string | undefined;
  editItem?: Data; // If provided, we're editing this item instead of creating new
};

export const EditItemDialog = (props: EditItemDialogProps) => {
  const document = useDocument();
  const diagram = useDiagram();
  const db = document.data.db;
  const dbUndoable = new DataManagerUndoableFacade(diagram.undoManager, document.data.db);
  const [formData, setFormData] = useState<Record<string, undefined | string | string[]>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();

  const schema = db.schemas.find(s => s.id === props.selectedSchema) ?? db.schemas[0];

  if (!schema) return <div></div>;
  assert.present(schema);

  // Reset form when dialog opens
  const handleOpen = () => {
    const initialData: Record<string, string | string[]> = {};
    schema.fields.forEach(field => {
      if (field.type === 'reference') {
        initialData[field.id] = decodeDataReferences(props.editItem?.[field.id]);
      } else {
        initialData[field.id] = props.editItem ? (props.editItem[field.id] ?? '') : '';
      }
    });
    setFormData(initialData);
    setSubmitError(undefined);
  };

  // Handle form submission
  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const isEditing = !!props.editItem;
    const requiredMethod = isEditing ? 'updateData' : 'addData';

    if (!(requiredMethod in db)) return;

    setSubmitError(undefined);

    // Validate required fields
    const missingFields = schema.fields.filter(field => {
      const value = formData[field.id];
      if (field.type === 'reference') {
        const refs = value as string[];
        return refs.length < field.minCount;
      } else {
        return !(value as string).trim();
      }
    });
    if (missingFields.length > 0) {
      setSubmitError(`Please fill in: ${missingFields.map(f => f.name).join(', ')}`);
      e.preventDefault(); // Prevent dialog from closing
      return;
    }

    // Validate reference field constraints
    const invalidReferenceFields = schema.fields.filter(field => {
      if (field.type === 'reference') {
        const refs = formData[field.id] as string[];
        return refs.length > field.maxCount;
      }
      return false;
    });
    if (invalidReferenceFields.length > 0) {
      setSubmitError(
        `Too many references in: ${invalidReferenceFields.map(f => f.name).join(', ')}`
      );
      e.preventDefault();
      return;
    }

    try {
      const processedData: Record<string, string> = {};
      schema.fields.forEach(field => {
        const value = formData[field.id];
        if (field.type === 'reference') {
          processedData[field.id] = encodeDataReferences(value as string[]);
        } else {
          processedData[field.id] = value as string;
        }
      });

      const itemData: Data = {
        ...processedData,
        _uid: isEditing ? props.editItem!._uid : newid()
      };

      if (isEditing) {
        await dbUndoable.updateData(schema, props.editItem!, itemData);
      } else {
        await dbUndoable.addData(schema, itemData);
      }

      // Only close dialog and reset form on success
      props.onClose();
      setFormData({});
    } catch (error) {
      const action = isEditing ? 'update' : 'add';
      setSubmitError(
        `Failed to ${action} item: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      e.preventDefault(); // Prevent dialog from closing
    }
  };

  const handleCancel = () => {
    setFormData({});
    setSubmitError(undefined);
    props.onClose();
  };

  // Initialize form data when dialog opens
  if (props.open && Object.keys(formData).length === 0) {
    handleOpen();
  }

  const isEditing = !!props.editItem;

  return (
    <Dialog
      title={isEditing ? 'Edit Item' : 'Add Item'}
      open={props.open}
      onClose={handleCancel}
      buttons={[
        {
          type: 'default',
          label: 'Cancel',
          onClick: handleCancel
        },
        {
          type: 'default',
          label: isEditing ? 'Update' : 'Add',
          onClick: handleSubmit
        }
      ]}
    >
      <div className={'util-vstack'} style={{ gap: '0.5rem' }}>
        {submitError && (
          <div
            style={{
              color: 'var(--error-fg)',
              padding: '0.5rem 0',
              background: 'var(--error-bg)',
              borderRadius: 'var(--cmp-radius)'
            }}
          >
            {submitError}
          </div>
        )}
        {schema.fields.map(field => (
          <div key={field.id} className={'util-vstack'} style={{ gap: '0.2rem' }}>
            <label>{field.name}:</label>
            {field.type === 'reference' && (
              <ReferenceFieldEditor
                field={field}
                selectedValues={formData[field.id] as string[]}
                onSelectionChange={values => setFormData(prev => ({ ...prev, [field.id]: values }))}
              />
            )}
            {field.type === 'longtext' && (
              <TextArea
                value={(formData[field.id] as string | undefined) ?? ''}
                onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
                style={{
                  minHeight: '5rem'
                }}
              />
            )}
            {field.type === 'select' && (
              <Select.Root
                value={
                  (formData[field.id] === ''
                    ? field.options[0]?.value
                    : (formData[field.id] as string)) ?? ''
                }
                onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
              >
                {field.options.map(o => (
                  <Select.Item key={o.value} value={o.value}>
                    {o.label}
                  </Select.Item>
                ))}
              </Select.Root>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
};
