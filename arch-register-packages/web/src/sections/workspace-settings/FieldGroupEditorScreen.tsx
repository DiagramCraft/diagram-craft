import { useCallback, useEffect, useState, type RefCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Title } from '../../components/Title';
import { FieldConfig } from '../../components/FieldConfig';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useCreateFieldGroup,
  useDeleteFieldGroup,
  useUpdateFieldGroup
} from '../../hooks/useFieldGroups';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { FIELD_TYPES, type FieldType } from '../../lib/schemaPresentation';
import { toFieldId } from '../../utils/fieldId';
import { FieldConfigList } from '../../components/FieldConfigList';
import { moveInArray } from '../../utils/arrayReorder';
import styles from './SchemaSettingsScreen.module.css';

const FIELDS_LIST_ID = 'shared-fieldgroup-fields';
import { ScalarCardinalityControls } from './ScalarCardinalityControls';
import {
  isScalarCardinalityField,
  scalarCardinalityPatchForRequirement
} from './scalarCardinality';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

const SharedFieldRow = ({
  field,
  schemas,
  relationSchemas,
  enums,
  onUpdate,
  onChangeType,
  onRemove,
  containmentDisabled,
  canEdit,
  dragHandleRef
}: {
  field: SchemaField;
  schemas: { id: string; name: string }[];
  relationSchemas: { id: string; name: string }[];
  enums: { id: string; name: string }[];
  onUpdate: (patch: Partial<SchemaField>) => void;
  onChangeType: (type: FieldType) => void;
  onRemove?: () => void;
  containmentDisabled: boolean;
  canEdit: boolean;
  dragHandleRef: RefCallback<HTMLElement>;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));

  const options = () => {
    if (field.type === 'select') {
      return (
        <>
          <ScalarCardinalityControls field={field} onUpdate={onUpdate} disabled={!canEdit} />
          <FormElement label="Enum">
            <Select.Root
              value={field.enumId ?? undefined}
              disabled={!canEdit}
              onChange={value => onUpdate({ enumId: value ?? '' } as Partial<SchemaField>)}
              placeholder="Select enum..."
            >
              {enums.map(item => (
                <Select.Item key={item.id} value={item.id}>
                  {item.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        </>
      );
    }
    if (field.type === 'reference' || field.type === 'containment') {
      return (
        <FormElement label={field.type === 'reference' ? 'Reference target' : 'Containment target'}>
          <Select.Root
            value={field.schemaId ?? undefined}
            disabled={!canEdit}
            onChange={value => onUpdate({ schemaId: value ?? '' } as Partial<SchemaField>)}
            placeholder="Select type..."
          >
            {schemas.map(item => (
              <Select.Item key={item.id} value={item.id}>
                {item.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
      );
    }
    if (field.type === 'typedRelation') {
      return (
        <>
          <FormElement label="Relation type">
            <Select.Root
              value={field.relationSchemaId || undefined}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({ relationSchemaId: value ?? '' } as Partial<SchemaField>)
              }
              placeholder="Select a relation type..."
            >
              {relationSchemas.map(item => (
                <Select.Item key={item.id} value={item.id}>
                  {item.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          <FormElement label="Direction">
            <Select.Root
              value={field.direction}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({ direction: (value ?? 'out') as 'in' | 'out' } as Partial<SchemaField>)
              }
            >
              <Select.Item value="out">Out (this entity is the "out" endpoint)</Select.Item>
              <Select.Item value="in">In (this entity is the "in" endpoint)</Select.Item>
            </Select.Root>
          </FormElement>
          <FormElement label="Min">
            <TextInput
              value={String(field.minCount)}
              disabled={!canEdit}
              onChange={value => {
                const next = Number(value ?? 0);
                onUpdate({
                  minCount: Number.isNaN(next) ? 0 : Math.max(0, Math.trunc(next))
                } as Partial<SchemaField>);
              }}
            />
          </FormElement>
          <FormElement label="Max">
            <TextInput
              value={field.maxCount === -1 ? '' : String(field.maxCount)}
              disabled={!canEdit}
              onChange={value => {
                const raw = value ?? '';
                if (raw.trim() === '') {
                  onUpdate({ maxCount: -1 } as Partial<SchemaField>);
                  return;
                }
                const next = Number(raw);
                onUpdate({
                  maxCount: Number.isNaN(next) ? -1 : Math.max(0, Math.trunc(next))
                } as Partial<SchemaField>);
              }}
              placeholder="Unbounded"
            />
          </FormElement>
        </>
      );
    }
    if (
      field.type === 'text' ||
      field.type === 'longtext' ||
      field.type === 'boolean' ||
      field.type === 'date' ||
      field.type === 'currency' ||
      field.type === 'number'
    ) {
      return <ScalarCardinalityControls field={field} onUpdate={onUpdate} disabled={!canEdit} />;
    }
    if (field.type === 'derived') {
      return (
        <FormElement label="Expression">
          <TextArea
            value={field.expression}
            disabled={!canEdit}
            onChange={value => onUpdate({ expression: value ?? '' } as Partial<SchemaField>)}
            rows={2}
            placeholder="entity.input_field"
          />
        </FormElement>
      );
    }
    return undefined;
  };

  return (
    <FieldConfig dragHandleRef={dragHandleRef} options={options()}>
      <FieldConfig.Cell label="Id" mono flexBasis={160}>
        <TextInput
          value={field.id}
          disabled={!canEdit}
          onChange={value => {
            setIdUserEdited(true);
            onUpdate({ id: value ?? '' });
          }}
          style={{ width: '100%' }}
        />
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Label" flexBasis={160}>
        <TextInput
          value={field.name}
          disabled={!canEdit}
          onChange={value => {
            const name = value ?? '';
            onUpdate(idUserEdited ? { name } : { name, id: toFieldId(name) });
          }}
          style={{ width: '100%' }}
        />
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Type" flexBasis={140}>
        <Select.Root
          value={field.type}
          disabled={!canEdit}
          onChange={value => {
            if (value) onChangeType(value as FieldType);
          }}
          style={{ width: '100%' }}
        >
          {FIELD_TYPES.map(item => (
            <Select.Item
              key={item.value}
              value={item.value}
              disabled={item.value === 'containment' && containmentDisabled}
            >
              {item.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Completeness" flexBasis={120}>
        <Select.Root
          value={field.requirementLevel ?? 'optional'}
          disabled={!canEdit || field.type === 'derived'}
          onChange={value => {
            const requirementLevel = (value ?? 'optional') as SchemaField['requirementLevel'];
            onUpdate(
              isScalarCardinalityField(field)
                ? scalarCardinalityPatchForRequirement(field, requirementLevel ?? 'optional')
                : { requirementLevel }
            );
          }}
          style={{ width: '100%' }}
        >
          <Select.Item value="optional">Optional</Select.Item>
          <Select.Item value="expected">Expected</Select.Item>
          <Select.Item value="required">Required</Select.Item>
        </Select.Root>
      </FieldConfig.Cell>
      {onRemove && (
        <FieldConfig.Cell label="Actions" flexBasis={80}>
          <Button variant="ghost" onClick={onRemove} disabled={!canEdit}>
            Remove
          </Button>
        </FieldConfig.Cell>
      )}
    </FieldConfig>
  );
};

export const FieldGroupEditorScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const {
    workspaceSlug,
    fieldGroups = [],
    schemas,
    relationSchemas,
    enums,
    permissions
  } = useWorkspaceContext();
  const selected = fieldGroups.find(group => group.id === search.fieldGroupId) ?? null;
  const canEdit = permissions.canEditSchemas;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateFieldGroup(workspaceSlug);
  const updateMutation = useUpdateFieldGroup(workspaceSlug);
  const deleteMutation = useDeleteFieldGroup(workspaceSlug);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description ?? '');
    setFields(selected.fields as SchemaField[]);
    setDirty(false);
  }, [selected]);

  const selectGroup = useCallback(
    (id: string | undefined) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'fieldgroups', fieldGroupId: id }
      });
    },
    [navigate, workspaceSlug]
  );

  const create = async () => {
    try {
      const group = await createMutation.mutateAsync({ name: 'New fieldgroup', fields: [] });
      selectGroup(group.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create fieldgroup');
    }
  };

  const save = async () => {
    if (!selected || !dirty) return;
    try {
      await updateMutation.mutateAsync({
        fieldGroupId: selected.id,
        data: { name, description, fields }
      });
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update fieldgroup');
    }
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await deleteMutation.mutateAsync(selected.id);
      selectGroup(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete fieldgroup');
    }
  };

  const addField = () => {
    const id = toFieldId('new_field');
    setFields(current => [...current, { id, name: 'new_field', type: 'text' }]);
    setDirty(true);
  };

  const reorderFields = (fromIndex: number, toIndex: number) => {
    setFields(current => moveInArray(current, fromIndex, toIndex));
    setDirty(true);
  };

  const changeType = (fieldId: string, type: FieldType) => {
    setFields(current =>
      current.map(field => {
        if (field.id !== fieldId) return field;
        const base = { id: field.id, name: field.name };
        switch (type) {
          case 'text':
          case 'longtext':
          case 'date':
          case 'currency':
          case 'boolean':
          case 'number':
          case 'principal':
            return { ...base, type } as SchemaField;
          case 'select':
            return { ...base, type, enumId: enums[0]?.id ?? '' } as SchemaField;
          case 'reference':
            return {
              ...base,
              type,
              schemaId: schemas[0]?.id ?? '',
              minCount: 0,
              maxCount: -1
            } as SchemaField;
          case 'containment':
            return {
              ...base,
              type,
              schemaId: schemas[0]?.id ?? '',
              minCount: 0,
              maxCount: 1
            } as SchemaField;
          case 'derived':
            return {
              ...base,
              type,
              requirementLevel: 'optional',
              expression: '""',
              resultType: 'text'
            } as SchemaField;
          case 'typedRelation':
            return {
              ...base,
              type,
              relationSchemaId: '',
              direction: 'out',
              minCount: 0,
              maxCount: -1
            } as SchemaField;
        }
      })
    );
    setDirty(true);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <Title
          eyebrow="Data model"
          title="Shared fieldgroups"
          description="Reusable field definitions included by multiple entity types."
          buttons={
            canEdit ? (
              <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => void create()}>
                New fieldgroup
              </Button>
            ) : undefined
          }
        />
      </div>
      {selected ? (
        <div className={styles.editor}>
          <Title title={name} description={`${fields.length} fields`} />
          {error && <div role="alert">{error}</div>}
          <div className={styles.formRow}>
            <div>
              <div className={styles.formLabel}>Name</div>
              <TextInput
                value={name}
                readOnly={!canEdit}
                onChange={value => {
                  setName(value ?? '');
                  setDirty(true);
                }}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div>
              <div className={styles.formLabel}>Description</div>
              <TextArea
                value={description}
                readOnly={!canEdit}
                onChange={value => {
                  setDescription(value ?? '');
                  setDirty(true);
                }}
                rows={3}
              />
            </div>
          </div>
          <div className={styles.fieldsHead}>
            <div className={styles.sectionLabel}>Fields</div>
            {canEdit && (
              <Button variant="ghost" icon={<TbPlus size={11} />} onClick={addField}>
                Add field
              </Button>
            )}
          </div>
          <FieldConfigList
            items={fields}
            getId={field => field.id}
            listId={FIELDS_LIST_ID}
            onReorder={reorderFields}
            renderItem={(field, _index, drag) => (
              <SharedFieldRow
                field={field}
                schemas={schemas}
                relationSchemas={relationSchemas}
                enums={enums}
                onUpdate={patch => {
                  setFields(current =>
                    current.map(item =>
                      item.id === field.id ? ({ ...item, ...patch } as SchemaField) : item
                    )
                  );
                  setDirty(true);
                }}
                onChangeType={type => changeType(field.id, type)}
                onRemove={
                  canEdit
                    ? () => {
                        setFields(current => current.filter(item => item.id !== field.id));
                        setDirty(true);
                      }
                    : undefined
                }
                containmentDisabled={fields.some(
                  item => item.id !== field.id && item.type === 'containment'
                )}
                canEdit={canEdit}
                dragHandleRef={drag.ref}
              />
            )}
          />
          <div className={styles.formActions}>
            {canEdit && (
              <Button variant="danger" icon={<TbTrash size={12} />} onClick={() => void remove()}>
                Delete fieldgroup
              </Button>
            )}
            <div style={{ flex: 1 }} />
            {canEdit && dirty && (
              <Button
                variant="primary"
                onClick={() => void save()}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.fieldsEmpty}>Select a fieldgroup or create a new one.</div>
      )}
    </div>
  );
};
