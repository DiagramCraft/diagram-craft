import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { DataProvider, MutableDataProvider, Data } from '@diagram-craft/model/dataProvider';
import { DataSchemaField } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { newid } from '@diagram-craft/utils/id';
import { assert } from '@diagram-craft/utils/assert';
import React, { useState } from 'react';

type ReferenceFieldEditorProps = {
  field: DataSchemaField & { type: 'reference' };
  dataProvider: DataProvider;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
};

const ReferenceFieldEditor = ({
  field,
  dataProvider,
  selectedValues,
  onSelectionChange
}: ReferenceFieldEditorProps) => {
  const referencedSchema = dataProvider.schemas?.find(s => s.id === field.schemaId);
  if (!referencedSchema) {
    return <div>Referenced schema not found</div>;
  }

  const referencedData = dataProvider.getData(referencedSchema);
  const displayField = referencedSchema.fields[0]?.id; // Use first field for display

  // Convert data to MultiSelectItem format
  const availableItems: MultiSelectItem[] =
    referencedData?.map(item => {
      const fieldValue = item[displayField];
      let label: string = item._uid; // Default fallback

      if (typeof fieldValue === 'string' && fieldValue) {
        label = fieldValue;
      }

      return {
        value: item._uid,
        label: label
      };
    }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <MultiSelect
        selectedValues={selectedValues}
        availableItems={availableItems}
        onSelectionChange={onSelectionChange}
        placeholder={`Search ${referencedSchema.name}...`}
      />

      {/* Info about constraints */}
      <div style={{ fontSize: '0.8em', color: 'var(--cmp-fg-dim)' }}>
        {field.minCount > 0 && `Minimum ${field.minCount} required. `}
        {field.maxCount < Number.MAX_SAFE_INTEGER && `Maximum ${field.maxCount} allowed.`}
        {selectedValues.length > 0 && ` (${selectedValues.length} selected)`}
      </div>
    </div>
  );
};

type EditItemDialogProps = {
  open: boolean;
  onClose: () => void;
  dataProvider: DataProvider | undefined;
  selectedSchema: string | undefined;
  editItem?: Data; // If provided, we're editing this item instead of creating new
};

export const EditItemDialog = (props: EditItemDialogProps) => {
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();

  if (!props.dataProvider) return <div></div>;
  assert.present(props.dataProvider);

  const dataProvider = props.dataProvider;

  const schema =
    props.dataProvider.schemas?.find(s => s.id === props.selectedSchema) ??
    props.dataProvider.schemas?.[0];

  if (!schema) return <div></div>;
  assert.present(schema);

  // Reset form when dialog opens
  const handleOpen = () => {
    const initialData: Record<string, string | string[]> = {};
    schema.fields.forEach(field => {
      if (field.type === 'reference') {
        // For reference fields, parse JSON array or initialize empty array
        if (props.editItem) {
          try {
            initialData[field.id] = JSON.parse(props.editItem[field.id] ?? '[]');
          } catch {
            initialData[field.id] = [];
          }
        } else {
          initialData[field.id] = [];
        }
      } else {
        // For text/longtext fields, use string value
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

    if (!(requiredMethod in dataProvider)) return;

    setSubmitError(undefined);

    // Validate required fields
    const missingFields = schema.fields.filter(field => {
      const value = formData[field.id];
      if (field.type === 'reference') {
        const refs = value as string[];
        return refs.length < field.minCount;
      } else {
        return !(value as string)?.trim();
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
      // Convert reference field arrays to JSON strings for storage
      const processedData: Record<string, string> = {};
      schema.fields.forEach(field => {
        const value = formData[field.id];
        if (field.type === 'reference') {
          processedData[field.id] = JSON.stringify(value as string[]);
        } else {
          processedData[field.id] = value as string;
        }
      });

      const itemData: Data = {
        ...processedData,
        _uid: isEditing ? props.editItem!._uid : newid()
      };

      if (isEditing) {
        await (dataProvider as MutableDataProvider).updateData(schema, itemData);
      } else {
        await (dataProvider as MutableDataProvider).addData(schema, itemData);
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
      // Don't close dialog on error - let user see the error and try again
    }
  };

  // Handle cancel - clear form and close dialog
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
            {field.type === 'reference' ? (
              <ReferenceFieldEditor
                field={field}
                dataProvider={dataProvider}
                selectedValues={(formData[field.id] as string[]) || []}
                onSelectionChange={values => setFormData(prev => ({ ...prev, [field.id]: values }))}
              />
            ) : field.type === 'longtext' ? (
              <TextArea
                value={(formData[field.id] as string) ?? ''}
                onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
                style={{
                  minHeight: '5rem'
                }}
              />
            ) : (
              <TextInput
                value={(formData[field.id] as string) ?? ''}
                onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
              />
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
};
