import { useCallback, useEffect, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import type { WorkspaceEnumOption } from '@arch-register/api-types/enumContract';
import { useCreateEnum, useDeleteEnum, useUpdateEnum } from '../../hooks/useEnums';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { moveInArray } from '../../utils/arrayReorder';

export const NEW_ENUM_ID = 'new';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export type EditableOption = WorkspaceEnumOption & {
  originalValue?: string;
  pendingRemoval?: boolean;
};

const toEditableOption = (option: WorkspaceEnumOption): EditableOption => ({
  ...option,
  originalValue: option.value
});

export const newEditableOption = (): EditableOption => ({
  value: '',
  label: '',
  description: null,
  retired: false,
  restricted: false
});

/**
 * Draft state and persistence for the enum editor: edits, dirty tracking, revert, save and
 * delete. Presentation stays in `EnumEditorScreen`.
 */
export const useEnumDraft = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedEnumId = search.enumId ?? null;
  const { workspaceSlug, enums } = useWorkspaceContext();
  const isNew = selectedEnumId === NEW_ENUM_ID;

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [options, setOptions] = useState<EditableOption[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createEnumMutation = useCreateEnum(workspaceSlug);
  const updateEnumMutation = useUpdateEnum(workspaceSlug);
  const deleteEnumMutation = useDeleteEnum(workspaceSlug);

  const selected = enums.find(e => e.id === selectedEnumId) ?? null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setCategoryId(selected.category?.id ?? null);
      setOptions(selected.options.map(toEditableOption));
      setDirty(false);
    } else if (isNew) {
      setName('');
      setCategoryId(null);
      setOptions([]);
      setDirty(true);
    }
  }, [selected, isNew]);

  const revert = () => {
    if (selected) {
      setName(selected.name);
      setCategoryId(selected.category?.id ?? null);
      setOptions(selected.options.map(toEditableOption));
      setDirty(false);
    } else if (isNew) {
      setName('');
      setCategoryId(null);
      setOptions([]);
      setDirty(true);
    }
    setErrorMessage(null);
  };

  const handleSave = useCallback(async () => {
    if (!dirty) return;
    const parsedOptions: WorkspaceEnumOption[] = options
      .filter(option => !option.pendingRemoval)
      .map(
        ({ originalValue: _originalValue, pendingRemoval: _pendingRemoval, ...option }) => option
      );
    try {
      if (isNew) {
        const created = await createEnumMutation.mutateAsync({
          name,
          category_id: categoryId,
          options: parsedOptions
        });
        navigate({
          to: '/$workspaceSlug/settings/schemas',
          params: { workspaceSlug },
          search: { tab: 'enums', enumId: created.id }
        });
      } else if (selected) {
        await updateEnumMutation.mutateAsync({
          enumId: selected.id,
          data: { name, category_id: categoryId, options: parsedOptions }
        });
        setDirty(false);
      }
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to save enum');
    }
  }, [
    isNew,
    selected,
    dirty,
    createEnumMutation,
    updateEnumMutation,
    navigate,
    workspaceSlug,
    name,
    categoryId,
    options
  ]);

  const doDelete = useCallback(async () => {
    if (!selected) return;
    try {
      await deleteEnumMutation.mutateAsync(selected.id);
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'enums' }
      });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to delete enum');
    }
  }, [selected, deleteEnumMutation, navigate, workspaceSlug]);

  const addOption = () => {
    setOptions(prev => [...prev, newEditableOption()]);
    setDirty(true);
  };

  const updateOption = (index: number, patch: Partial<EditableOption>) => {
    setOptions(prev => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
    setDirty(true);
  };

  const removeOption = (index: number) => {
    const option = options[index];
    if (option?.originalValue !== undefined) {
      updateOption(index, { retired: true, pendingRemoval: true });
      return;
    }
    setOptions(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const reorderOptions = (fromIndex: number, toIndex: number) => {
    setOptions(prev => moveInArray(prev, fromIndex, toIndex));
    setDirty(true);
  };

  return {
    selected,
    isNew,
    name,
    categoryId,
    options,
    dirty,
    confirmDelete,
    setConfirmDelete,
    errorMessage,
    setErrorMessage,
    isSaving: updateEnumMutation.isPending || createEnumMutation.isPending,
    setName: (value: string) => {
      setName(value);
      setDirty(true);
    },
    setCategoryId: (value: string | null) => {
      setCategoryId(value);
      setDirty(true);
    },
    addOption,
    updateOption,
    removeOption,
    reorderOptions,
    revert,
    save: handleSave,
    remove: doDelete
  };
};
