import { useCallback, useEffect, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Title } from '../../components/Title';
import { FieldRow } from './SchemaSettingsScreen';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useCreateFieldGroup,
  useDeleteFieldGroup,
  useUpdateFieldGroup
} from '../../hooks/useFieldGroups';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { type FieldType } from '../../lib/schemaPresentation';
import { toFieldId } from '../../utils/fieldId';
import styles from './SchemaSettingsScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const FieldGroupEditorScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug, fieldGroups = [], schemas, enums, permissions } = useWorkspaceContext();
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

  const changeType = (fieldId: string, type: FieldType) => {
    setFields(current =>
      current.map(field => {
        if (field.id !== fieldId) return field;
        const base = { id: field.id, name: field.name };
        switch (type) {
          case 'text':
          case 'longtext':
          case 'date':
          case 'boolean':
          case 'number':
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
          {fields.map(field => (
            <FieldRow
              key={field.id}
              field={field}
              fields={fields}
              schemas={schemas}
              enums={enums}
              groups={[]}
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
            />
          ))}
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
