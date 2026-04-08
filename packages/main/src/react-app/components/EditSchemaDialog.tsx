import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbTrash } from 'react-icons/tb';
import type { DataSchema, DataSchemaField } from '@diagram-craft/model/diagramDocumentDataSchemas';
import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { newid } from '@diagram-craft/utils/id';
import { Scrollable } from '@diagram-craft/app-components/Scrollable';
import { ErrorMessage } from '@diagram-craft/app-components/ErrorMessage';
import { $t } from '@diagram-craft/utils/localize';

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
      setName($t('dialog.schema.new_schema', 'New schema'));
      setFields(INITIAL_SCHEMA_FIELDS);
      setOriginalFieldIds(new Set());
      setErrors({});
    }
  }, [props.open, props.schema]);

  const addFieldAfter = (index: number) => {
    const fieldNumber = fields.length + 1;
    const newField: DataSchemaField = {
      id: `field${fieldNumber}`,
      name: $t('dialog.schema.field', 'Field') + ` ${fieldNumber}`,
      type: 'text'
    };
    setFields(currentFields => currentFields.toSpliced(index + 1, 0, newField));
  };

  const removeField = (index: number) => {
    setFields(currentFields => currentFields.toSpliced(index, 1));
  };

  const updateField = (fieldIndex: number, updates: Partial<DataSchemaField>) => {
    setFields(currentFields =>
      currentFields.map((field, index) =>
        index === fieldIndex ? ({ ...field, ...updates } as DataSchemaField) : field
      )
    );
  };

  const validateSchema = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = $t('dialog.schema.error.name_required', 'Schema name is required');
    }

    const fieldNames = new Set<string>();
    const fieldIds = new Set<string>();

    fields.forEach((field, index) => {
      if (!field.name.trim()) {
        newErrors[`field-${index}-name`] = $t(
          'dialog.schema.error.field_name_required',
          'Field name is required'
        );
      }

      if (fieldNames.has(field.name.toLowerCase())) {
        newErrors[`field-${index}-name`] = $t(
          'dialog.schema.error.field_name_unique',
          'Field name must be unique'
        );
      }
      fieldNames.add(field.name.toLowerCase());

      if (!field.id.trim()) {
        newErrors[`field-${index}-id`] = $t(
          'dialog.schema.error.field_id_required',
          'Field ID is required'
        );
      } else if (!/^[a-zA-Z0-9_]+$/.test(field.id)) {
        newErrors[`field-${index}-id`] = $t(
          'dialog.schema.error.field_id_format',
          'Field ID must contain only letters, numbers, and underscores'
        );
      }

      if (fieldIds.has(field.id)) {
        newErrors[`field-${index}-id`] = $t(
          'dialog.schema.error.field_id_unique',
          'Field ID must be unique'
        );
      }
      fieldIds.add(field.id);

      if (field.type === 'reference') {
        if (!field.schemaId) {
          newErrors[`field-${index}-schemaId`] = $t(
            'dialog.schema.error.schema_required',
            'Referenced schema is required'
          );
        }
        if (field.minCount < 0) {
          newErrors[`field-${index}-minCount`] = $t(
            'dialog.schema.error.min_count_negative',
            'Minimum count cannot be negative'
          );
        }
        if (field.maxCount < field.minCount) {
          newErrors[`field-${index}-maxCount`] = $t(
            'dialog.schema.error.max_count_range',
            'Maximum count must be greater than or equal to minimum count'
          );
        }
      }

      if (field.type === 'select') {
        if (!field.options || field.options.length === 0) {
          newErrors[`field-${index}-options`] = $t(
            'dialog.schema.error.options_required',
            'At least one option is required'
          );
        } else {
          const optionValues = new Set<string>();
          field.options.forEach((option, optionIndex) => {
            if (!option.value.trim()) {
              newErrors[`field-${index}-option-${optionIndex}-value`] = $t(
                'dialog.schema.error.option_value_required',
                'Option value is required'
              );
            }
            if (!option.label.trim()) {
              newErrors[`field-${index}-option-${optionIndex}-label`] = $t(
                'dialog.schema.error.option_label_required',
                'Option label is required'
              );
            }
            if (optionValues.has(option.value)) {
              newErrors[`field-${index}-option-${optionIndex}-value`] = $t(
                'dialog.schema.error.option_value_unique',
                'Option value must be unique'
              );
            }
            optionValues.add(option.value);
          });
        }
      }
    });

    if (fields.length === 0) {
      newErrors.fields = $t(
        'dialog.schema.error.fields_required',
        'At least one field is required'
      );
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
      onClose={props.onCancel}
      buttons={[
        {
          label: $t('common.save', 'Save'),
          type: 'default',
          onClick: handleSave
        },
        {
          label: $t('common.cancel', 'Cancel'),
          type: 'cancel',
          onClick: props.onCancel
        }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label>{$t('dialog.schema.schema_name', 'Schema Name')}:</label>
        <TextInput
          id="schema-name"
          value={name}
          onChange={value => setName(value ?? '')}
          placeholder={$t('dialog.schema.enter_schema_name', 'Enter schema name')}
        />
        {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          minWidth: '400px',
          minHeight: '300px',
          marginTop: '0.5rem'
        }}
      >
        <label style={{ display: 'block' }}>{$t('dialog.schema.fields', 'Fields')}:</label>

        {errors.fields && <ErrorMessage>{errors.fields}</ErrorMessage>}

        <Scrollable
          maxHeight="50vh"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            borderTop: '1px solid var(--cmp-border)',
            border: '1px solid var(--cmp-border)'
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
                key={index}
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
                      onChange={value => updateField(index, { id: value ?? '' })}
                      placeholder={$t('dialog.schema.field_id', 'Field ID')}
                      disabled={isFieldIdReadOnly}
                      title={
                        isFieldIdReadOnly
                          ? $t(
                              'dialog.schema.error.field_id_locked',
                              'Field ID cannot be changed when schema has data'
                            )
                          : $t(
                              'dialog.schema.field_id_format',
                              'Field ID (letters, numbers, hyphens, and underscores only)'
                            )
                      }
                    />
                    {errors[`field-${index}-id`] && (
                      <ErrorMessage style={{ fontSize: '0.8em', marginTop: '0.2rem' }}>
                        {errors[`field-${index}-id`]}
                      </ErrorMessage>
                    )}
                  </div>

                  <div style={{ flex: 2 }}>
                    <TextInput
                      value={field.name}
                      onChange={value => updateField(index, { name: value ?? '' })}
                      placeholder={$t('dialog.schema.field_name', 'Field name')}
                    />
                    {errors[`field-${index}-name`] && (
                      <ErrorMessage style={{ fontSize: '0.8em', marginTop: '0.2rem' }}>
                        {errors[`field-${index}-name`]}
                      </ErrorMessage>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <Select.Root
                      value={field.type}
                      onChange={value => {
                        const newType = (value ?? 'text') as
                          | 'text'
                          | 'longtext'
                          | 'reference'
                          | 'boolean'
                          | 'select';
                        if (newType === 'reference') {
                          updateField(index, {
                            type: newType,
                            schemaId: props.availableSchemas?.[0]?.id ?? '',
                            minCount: 0,
                            maxCount: 1
                          });
                        } else if (newType === 'select') {
                          updateField(index, {
                            type: newType,
                            options: [
                              {
                                value: 'option1',
                                label: $t('dialog.schema.option', 'Option') + ' 1'
                              },
                              {
                                value: 'option2',
                                label: $t('dialog.schema.option', 'Option') + ' 2'
                              }
                            ]
                          });
                        } else {
                          updateField(index, { type: newType });
                        }
                      }}
                    >
                      <Select.Item value="text">
                        {$t('dialog.schema.type.text', 'Text')}
                      </Select.Item>
                      <Select.Item value="longtext">
                        {$t('dialog.schema.type.long_text', 'Long Text')}
                      </Select.Item>
                      <Select.Item value="reference">
                        {$t('dialog.schema.type.reference', 'Reference')}
                      </Select.Item>
                      <Select.Item value="boolean">
                        {$t('dialog.schema.type.boolean', 'Boolean')}
                      </Select.Item>
                      <Select.Item value="select">
                        {$t('dialog.schema.type.select', 'Select')}
                      </Select.Item>
                    </Select.Root>
                  </div>

                  <Button
                    variant="icon-only"
                    onClick={() => addFieldAfter(index)}
                    title={$t('dialog.schema.add_field_below', 'Add field below')}
                  >
                    <TbPlus />
                  </Button>

                  <Button
                    variant="icon-only"
                    onClick={() => removeField(index)}
                    disabled={fields.length === 1}
                    title={
                      fields.length === 1
                        ? $t(
                            'dialog.schema.error.cannot_remove_last',
                            'Cannot remove the last field'
                          )
                        : $t('dialog.schema.remove_field', 'Remove field')
                    }
                  >
                    <TbTrash />
                  </Button>
                </div>

                {field.type === 'select' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ display: 'block' }}>
                      {$t('dialog.schema.options', 'Options')}:
                    </label>
                    {errors[`field-${index}-options`] && (
                      <ErrorMessage>{errors[`field-${index}-options`]}</ErrorMessage>
                    )}
                    <div
                      style={{
                        marginLeft: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      {field.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}
                        >
                          <div style={{ flex: 1 }}>
                            <TextInput
                              value={option.value}
                              onChange={value => {
                                const newOptions = [...field.options];
                                newOptions[optionIndex] = {
                                  ...newOptions[optionIndex]!,
                                  value: value ?? ''
                                };
                                updateField(index, { options: newOptions });
                              }}
                              placeholder={$t('dialog.schema.value', 'Value')}
                            />
                            {errors[`field-${index}-option-${optionIndex}-value`] && (
                              <ErrorMessage style={{ fontSize: '0.8em', marginTop: '0.2rem' }}>
                                {errors[`field-${index}-option-${optionIndex}-value`]}
                              </ErrorMessage>
                            )}
                          </div>
                          <div style={{ flex: 2 }}>
                            <TextInput
                              value={option.label}
                              onChange={value => {
                                const newOptions = [...field.options];
                                newOptions[optionIndex] = {
                                  ...newOptions[optionIndex]!,
                                  label: value ?? ''
                                };
                                updateField(index, { options: newOptions });
                              }}
                              placeholder={$t('dialog.schema.label', 'Label')}
                            />
                            {errors[`field-${index}-option-${optionIndex}-label`] && (
                              <ErrorMessage style={{ fontSize: '0.8em', marginTop: '0.2rem' }}>
                                {errors[`field-${index}-option-${optionIndex}-label`]}
                              </ErrorMessage>
                            )}
                          </div>
                          <Button
                            variant="icon-only"
                            onClick={() => {
                              const newOptions = [...field.options];
                              newOptions.splice(optionIndex + 1, 0, {
                                value: `option${field.options.length + 1}`,
                                label: `${$t('dialog.schema.option', 'Option')} ${field.options.length + 1}`
                              });
                              updateField(index, { options: newOptions });
                            }}
                            title={$t('dialog.schema.add_option_below', 'Add option below')}
                          >
                            <TbPlus />
                          </Button>
                          <Button
                            variant="icon-only"
                            onClick={() => {
                              const newOptions = field.options.filter((_, i) => i !== optionIndex);
                              updateField(index, { options: newOptions });
                            }}
                            disabled={field.options.length === 1}
                            title={
                              field.options.length === 1
                                ? $t(
                                    'dialog.schema.error.cannot_remove_last_option',
                                    'Cannot remove the last option'
                                  )
                                : $t('dialog.schema.remove_option', 'Remove option')
                            }
                          >
                            <TbTrash />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {field.type === 'reference' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block' }}>
                        {$t('dialog.schema.referenced_schema', 'Referenced Schema')}:
                      </label>
                      <Select.Root
                        value={field.schemaId}
                        onChange={value => updateField(index, { schemaId: value ?? '' })}
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
                        <ErrorMessage style={{ marginTop: '0.125rem' }}>
                          {errors[`field-${index}-schemaId`]}
                        </ErrorMessage>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block' }}>
                        {$t('dialog.schema.min_count', 'Min Count')}:
                      </label>
                      <TextInput
                        type="number"
                        value={field.minCount.toString()}
                        onChange={value =>
                          updateField(index, { minCount: parseInt(value ?? '0', 10) || 0 })
                        }
                        placeholder="0"
                      />
                      {errors[`field-${index}-minCount`] && (
                        <ErrorMessage style={{ marginTop: '0.12rem' }}>
                          {errors[`field-${index}-minCount`]}
                        </ErrorMessage>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block' }}>
                        {$t('dialog.schema.max_count', 'Max Count')}:
                      </label>
                      <TextInput
                        type="number"
                        value={field.maxCount.toString()}
                        onChange={value =>
                          updateField(index, { maxCount: parseInt(value ?? '1', 10) || 1 })
                        }
                        placeholder="1"
                      />
                      {errors[`field-${index}-maxCount`] && (
                        <ErrorMessage style={{ marginTop: '0.125rem' }}>
                          {errors[`field-${index}-maxCount`]}
                        </ErrorMessage>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Scrollable>
      </div>
    </Dialog>
  );
};
