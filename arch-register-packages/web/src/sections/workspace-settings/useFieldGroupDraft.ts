import { useEffect, useState } from 'react';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  useCreateFieldGroup,
  useDeleteFieldGroup,
  useUpdateFieldGroup
} from '../../hooks/useFieldGroups';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { FieldType } from '../../lib/schemaPresentation';
import { moveInArray } from '../../utils/arrayReorder';
import { toFieldId } from '../../utils/fieldId';

/**
 * Draft state and persistence for the shared field group editor: edits, dirty tracking, revert,
 * save and delete. Presentation stays in the screen.
 */
export const useFieldGroupDraft = ({
  workspaceSlug,
  selected,
  isNew,
  onSelect
}: {
  workspaceSlug: string;
  selected: SharedFieldGroup | null;
  isNew: boolean;
  onSelect: (id: string | undefined) => void;
}) => {
  const { schemas, enums } = useWorkspaceContext();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateFieldGroup(workspaceSlug);
  const updateMutation = useUpdateFieldGroup(workspaceSlug);
  const deleteMutation = useDeleteFieldGroup(workspaceSlug);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setCategoryId(selected.category?.id ?? null);
      setDescription(selected.description ?? '');
      setFields(selected.fields as SchemaField[]);
      setDirty(false);
    } else if (isNew) {
      setName('');
      setCategoryId(null);
      setDescription('');
      setFields([]);
      setDirty(true);
    }
  }, [selected, isNew]);

  const save = async () => {
    if (!dirty) return;
    try {
      if (isNew) {
        const group = await createMutation.mutateAsync({
          name,
          category_id: categoryId,
          description,
          fields
        });
        onSelect(group.id);
      } else if (selected) {
        await updateMutation.mutateAsync({
          fieldGroupId: selected.id,
          data: { name, category_id: categoryId, description, fields }
        });
        setDirty(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save fieldgroup');
    }
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await deleteMutation.mutateAsync(selected.id);
      onSelect(undefined);
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
          case 'duration':
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

  const revert = () => {
    if (selected) {
      setName(selected.name);
      setCategoryId(selected.category?.id ?? null);
      setDescription(selected.description ?? '');
      setFields(selected.fields as SchemaField[]);
      setDirty(false);
    } else if (isNew) {
      setName('');
      setCategoryId(null);
      setDescription('');
      setFields([]);
      setDirty(true);
    }
    setError(null);
  };

  const edit =
    <T>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setDirty(true);
    };

  return {
    name,
    categoryId,
    description,
    fields,
    dirty,
    error,
    isSaving: updateMutation.isPending || createMutation.isPending,
    setName: edit(setName),
    setCategoryId: edit(setCategoryId),
    setDescription: edit(setDescription),
    addField,
    reorderFields,
    changeType,
    updateField: (fieldId: string, patch: Partial<SchemaField>) => {
      setFields(current =>
        current.map(item => (item.id === fieldId ? ({ ...item, ...patch } as SchemaField) : item))
      );
      setDirty(true);
    },
    removeField: (fieldId: string) => {
      setFields(current => current.filter(item => item.id !== fieldId));
      setDirty(true);
    },
    revert,
    save,
    remove
  };
};
