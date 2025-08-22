import React, { useState, useEffect } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbTrash } from 'react-icons/tb';
import type { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { newid } from '@diagram-craft/utils/id';

type DataSchemaField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

type Props = {
  title: string;
  open: boolean;
  onOk: (schema: DataSchema) => void;
  onCancel: () => void;
  schema?: DataSchema;
};

const INITIAL_SCHEMA_FIELDS: DataSchemaField[] = [
  { id: 'field1', name: 'Field 1', type: 'text' },
  { id: 'field2', name: 'Field 2', type: 'longtext' }
];

export const EditSchemaDialog = (props: Props) => {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<DataSchemaField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (props.open && props.schema) {
      setName(props.schema.name);
      setFields([...props.schema.fields]);
      setErrors({});
    } else if (props.open && !props.schema) {
      setName('New schema');
      setFields(INITIAL_SCHEMA_FIELDS);
      setErrors({});
    }
  }, [props.open, props.schema]);

  const addFieldAfter = (index: number) => {
    const newField: DataSchemaField = {
      id: newid(),
      name: `Field ${fields.length + 1}`,
      type: 'text'
    };
    setFields(fields.toSpliced(index + 1, 0, newField));
  };

  const removeField = (index: number) => {
    setFields(fields.toSpliced(index, 1));
  };

  const updateField = (fieldId: string, updates: Partial<DataSchemaField>) => {
    setFields(fields.map(f => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const validateSchema = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Schema name is required';
    }

    const fieldNames = new Set<string>();
    const fieldIds = new Set<string>();

    fields.forEach((field, index) => {
      if (!field.name.trim()) {
        newErrors[`field-${index}-name`] = 'Field name is required';
      }

      if (fieldNames.has(field.name.toLowerCase())) {
        newErrors[`field-${index}-name`] = 'Field name must be unique';
      }
      fieldNames.add(field.name.toLowerCase());

      if (fieldIds.has(field.id)) {
        newErrors[`field-${index}-id`] = 'Field ID must be unique';
      }
      fieldIds.add(field.id);
    });

    if (fields.length === 0) {
      newErrors.fields = 'At least one field is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateSchema()) {
      return;
    }

    const resultSchema: DataSchema = {
      id: props.schema?.id ?? newid(),
      name: name.trim(),
      source: props.schema?.source ?? 'document',
      fields: fields.map(f => ({
        id: f.id,
        name: f.name.trim(),
        type: f.type
      }))
    };

    props.onOk(resultSchema);
  };

  return (
    <Dialog
      title={props.title}
      open={props.open}
      onClose={() => {}}
      buttons={[
        {
          label: 'Save',
          type: 'default',
          onClick: handleSave
        },
        {
          label: 'Cancel',
          type: 'cancel',
          onClick: props.onCancel
        }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '400px' }}>
        <div>
          <label>Schema Name:</label>
          <TextInput
            id="schema-name"
            value={name}
            onChange={value => setName(value ?? '')}
            placeholder="Enter schema name"
          />
          {errors.name && <div className="cmp-error">{errors.name}</div>}
        </div>

        <div>
          <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
            Fields:
          </label>

          {errors.fields && <div className="cmp-error">{errors.fields}</div>}

          <div
            style={{
              display: 'grid',
              gap: '0.5rem',
              gridTemplateColumns: '2fr 1fr min-content min-content',
              alignItems: 'start'
            }}
          >
            {fields.map((field, index) => (
              <React.Fragment key={field.id}>
                <div>
                  <TextInput
                    value={field.name}
                    onChange={value => updateField(field.id, { name: value ?? '' })}
                    placeholder="Field name"
                  />
                  {errors[`field-${index}-name`] && (
                    <div className="cmp-error" style={{ fontSize: '0.8em', marginTop: '0.2rem' }}>
                      {errors[`field-${index}-name`]}
                    </div>
                  )}
                </div>

                <Select.Root
                  value={field.type}
                  onChange={value =>
                    updateField(field.id, { type: (value ?? 'text') as 'text' | 'longtext' })
                  }
                >
                  <Select.Item value="text">Text</Select.Item>
                  <Select.Item value="longtext">Long Text</Select.Item>
                </Select.Root>

                <Button
                  type="icon-only"
                  onClick={() => addFieldAfter(index)}
                  title="Add field below"
                >
                  <TbPlus />
                </Button>

                <Button
                  type="icon-only"
                  onClick={() => removeField(index)}
                  disabled={fields.length === 1}
                  title={fields.length === 1 ? 'Cannot remove the last field' : 'Remove field'}
                >
                  <TbTrash />
                </Button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
