import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbTrash } from 'react-icons/tb';
import type { DataSchema, DataSchemaField } from '@diagram-craft/model/diagramDocumentDataSchemas';
import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { newid } from '@diagram-craft/utils/id';

type Props = {
  title: string;
  open: boolean;
  onOk: (schema: DataSchema) => void;
  onCancel: () => void;
  schema?: DataSchema;
  availableSchemas?: DataSchema[];
  document?: DiagramDocument;
};

const INITIAL_SCHEMA_FIELDS: DataSchemaField[] = [
  { id: 'field1', name: 'Field 1', type: 'text' },
  { id: 'field2', name: 'Field 2', type: 'longtext' }
];

const schemaHasAssociatedData = (
  document: DiagramDocument | undefined,
  schemaId: string
): boolean => {
  if (!document) return false;

  try {
    const schema = document.data.db.schemas.find(s => s.id === schemaId);
    if (!schema) return false;

    const data = document.data.db.getData(schema);
    return data.length > 0;
  } catch (_e) {
    return true;
  }
};

export const EditSchemaDialog = (props: Props) => {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<DataSchemaField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originalFieldIds, setOriginalFieldIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (props.open && props.schema) {
      setName(props.schema.name);
      setFields([...props.schema.fields]);
      setOriginalFieldIds(new Set(props.schema.fields.map(f => f.id)));
      setErrors({});
    } else if (props.open && !props.schema) {
      setName('New schema');
      setFields(INITIAL_SCHEMA_FIELDS);
      setOriginalFieldIds(new Set());
      setErrors({});
    }
  }, [props.open, props.schema]);

  const addFieldAfter = (index: number) => {
    const fieldNumber = fields.length + 1;
    const newField: DataSchemaField = {
      id: `field${fieldNumber}`,
      name: `Field ${fieldNumber}`,
      type: 'text'
    };
    setFields(fields.toSpliced(index + 1, 0, newField));
  };

  const removeField = (index: number) => {
    setFields(fields.toSpliced(index, 1));
  };

  const updateField = (fieldId: string, updates: Partial<DataSchemaField>) => {
    setFields(fields.map(f => (f.id === fieldId ? ({ ...f, ...updates } as DataSchemaField) : f)));
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

      if (!field.id.trim()) {
        newErrors[`field-${index}-id`] = 'Field ID is required';
      } else if (!/^[a-zA-Z0-9_]+$/.test(field.id)) {
        newErrors[`field-${index}-id`] =
          'Field ID must contain only letters, numbers, and underscores';
      }

      if (fieldIds.has(field.id)) {
        newErrors[`field-${index}-id`] = 'Field ID must be unique';
      }
      fieldIds.add(field.id);

      if (field.type === 'reference') {
        if (!field.schemaId) {
          newErrors[`field-${index}-schemaId`] = 'Referenced schema is required';
        }
        if (field.minCount < 0) {
          newErrors[`field-${index}-minCount`] = 'Minimum count cannot be negative';
        }
        if (field.maxCount < field.minCount) {
          newErrors[`field-${index}-maxCount`] =
            'Maximum count must be greater than or equal to minimum count';
        }
      }
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
      providerId: props.schema?.providerId ?? 'document',
      fields: fields
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
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--cmp-border)'
            }}
          >
            {fields.map((field, index) => {
              const hasData = props.schema
                ? schemaHasAssociatedData(props.document, props.schema.id)
                : false;
              const isOriginalField = originalFieldIds.has(field.id);
              const isFieldIdReadOnly = hasData && isOriginalField;

              return (
                <div
                  key={field.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--cmp-border)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <TextInput
                        value={field.id}
                        onChange={value => updateField(field.id, { id: value ?? '' })}
                        placeholder="Field ID"
                        disabled={isFieldIdReadOnly}
                        title={
                          isFieldIdReadOnly
                            ? 'Field ID cannot be changed when schema has data'
                            : 'Field ID (letters, numbers, hyphens, and underscores only)'
                        }
                      />
                      {errors[`field-${index}-id`] && (
                        <div
                          className="cmp-error"
                          style={{ fontSize: '0.8em', marginTop: '0.2rem' }}
                        >
                          {errors[`field-${index}-id`]}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 2 }}>
                      <TextInput
                        value={field.name}
                        onChange={value => updateField(field.id, { name: value ?? '' })}
                        placeholder="Field name"
                      />
                      {errors[`field-${index}-name`] && (
                        <div
                          className="cmp-error"
                          style={{ fontSize: '0.8em', marginTop: '0.2rem' }}
                        >
                          {errors[`field-${index}-name`]}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <Select.Root
                        value={field.type}
                        onChange={value => {
                          const newType = (value ?? 'text') as 'text' | 'longtext' | 'reference';
                          if (newType === 'reference') {
                            updateField(field.id, {
                              type: newType,
                              schemaId: props.availableSchemas?.[0]?.id ?? '',
                              minCount: 0,
                              maxCount: 1
                            });
                          } else {
                            updateField(field.id, { type: newType });
                          }
                        }}
                      >
                        <Select.Item value="text">Text</Select.Item>
                        <Select.Item value="longtext">Long Text</Select.Item>
                        <Select.Item value="reference">Reference</Select.Item>
                      </Select.Root>
                    </div>

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
                  </div>

                  {field.type === 'reference' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: 'block' }}>Referenced Schema:</label>
                        <Select.Root
                          value={field.schemaId}
                          onChange={value => updateField(field.id, { schemaId: value ?? '' })}
                        >
                          {props.availableSchemas
                            ?.filter(s => s.id !== props.schema?.id)
                            .map(schema => (
                              <Select.Item key={schema.id} value={schema.id}>
                                {schema.name}
                              </Select.Item>
                            ))}
                        </Select.Root>
                        {errors[`field-${index}-schemaId`] && (
                          <div className="cmp-error" style={{ marginTop: '0.125rem' }}>
                            {errors[`field-${index}-schemaId`]}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block' }}>Min Count:</label>
                        <TextInput
                          type="number"
                          value={field.minCount.toString()}
                          onChange={value =>
                            updateField(field.id, { minCount: parseInt(value ?? '0', 10) || 0 })
                          }
                          placeholder="0"
                        />
                        {errors[`field-${index}-minCount`] && (
                          <div className="cmp-error" style={{ marginTop: '0.12rem' }}>
                            {errors[`field-${index}-minCount`]}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block' }}>Max Count:</label>
                        <TextInput
                          type="number"
                          value={field.maxCount.toString()}
                          onChange={value =>
                            updateField(field.id, { maxCount: parseInt(value ?? '1', 10) || 1 })
                          }
                          placeholder="1"
                        />
                        {errors[`field-${index}-maxCount`] && (
                          <div className="cmp-error" style={{ marginTop: '0.125rem' }}>
                            {errors[`field-${index}-maxCount`]}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
