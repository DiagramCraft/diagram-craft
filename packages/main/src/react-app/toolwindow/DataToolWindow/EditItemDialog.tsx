import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { DataProvider, MutableDataProvider, Data } from '@diagram-craft/model/dataProvider';
import { newid } from '@diagram-craft/utils/id';
import { assert } from '@diagram-craft/utils/assert';
import React, { useState } from 'react';

type EditItemDialogProps = {
  open: boolean;
  onClose: () => void;
  dataProvider: DataProvider | undefined;
  selectedSchema: string | undefined;
};

export const EditItemDialog = (props: EditItemDialogProps) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();

  if (!props.dataProvider) return <div></div>;
  assert.present(props.dataProvider);

  const dataProvider = props.dataProvider;

  const schema =
    props.dataProvider.schemas?.find(s => s.id === props.selectedSchema) ??
    props.dataProvider.schemas?.[0];

  assert.present(schema);

  // Reset form when dialog opens
  const handleOpen = () => {
    const initialData: Record<string, string> = {};
    schema.fields.forEach(field => {
      initialData[field.id] = '';
    });
    setFormData(initialData);
    setSubmitError(undefined);
  };

  // Handle form submission
  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!('addData' in dataProvider)) return;

    setSubmitError(undefined);

    // Validate required fields
    const missingFields = schema.fields.filter(field => !formData[field.id]?.trim());
    if (missingFields.length > 0) {
      setSubmitError(`Please fill in: ${missingFields.map(f => f.name).join(', ')}`);
      e.preventDefault(); // Prevent dialog from closing
      return;
    }

    try {
      const newData: Data = {
        ...formData,
        _uid: newid()
      };

      await (dataProvider as MutableDataProvider).addData(schema, newData);

      // Only close dialog and reset form on success
      props.onClose();
      setFormData({});
    } catch (error) {
      setSubmitError(
        `Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  return (
    <Dialog
      title="Add Item"
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
          label: 'Add',
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
            {field.type === 'longtext' ? (
              <TextArea
                value={formData[field.id] ?? ''}
                onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
                style={{
                  minHeight: '80px'
                }}
              />
            ) : (
              <TextInput
                value={formData[field.id] ?? ''}
                onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
              />
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
};
