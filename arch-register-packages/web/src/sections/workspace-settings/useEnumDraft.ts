import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import type { WorkspaceEnumOption } from '@arch-register/api-types/enumContract';
import { useCreateEnum, useDeleteEnum, useUpdateEnum } from '../../hooks/useEnums';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { moveInArray } from '../../utils/arrayReorder';
import { useSchemaDraftState } from './useSchemaDraftState';
import { useDraftCategories } from './useDraftOverlay';
import { enumFromPayload } from './schemaDraftOverlay';

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
  const { workspaceSlug, enums: liveEnums } = useWorkspaceContext();
  const categories = useDraftCategories();
  const schemaDraft = useSchemaDraftState();
  const { isDraftMode } = schemaDraft;
  // Editors read the staged version of an item and fall back to live.
  const enums = useMemo(() => {
    const items = (schemaDraft.draft?.items ?? []).filter(i => i.kind === 'enum');
    const staged = items.filter(i => i.op !== 'delete');
    const stagedById = new Map(staged.map(i => [i.item_id, i]));
    const merged = liveEnums.map(e => {
      const item = stagedById.get(e.id);
      return item ? enumFromPayload(item.payload, e, e.id, workspaceSlug, categories) : e;
    });
    const liveIds = new Set(liveEnums.map(e => e.id));
    for (const item of staged) {
      if (item.op === 'create' && !liveIds.has(item.item_id)) {
        merged.push(
          enumFromPayload(item.payload, undefined, item.item_id, workspaceSlug, categories)
        );
      }
    }
    return merged;
  }, [liveEnums, categories, schemaDraft.draft, workspaceSlug]);
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
      if (isDraftMode) {
        const body = { name, category_id: categoryId, options: parsedOptions };
        const id = isNew ? crypto.randomUUID() : selected?.id;
        if (!id) return;
        const stagedAsCreate = schemaDraft.itemFor('enum', id)?.op === 'create';
        await schemaDraft.stage('enum', id, isNew || stagedAsCreate ? 'create' : 'update', body);
        if (isNew) {
          navigate({
            to: '/$workspaceSlug/settings/schemas',
            params: { workspaceSlug },
            search: { tab: 'enums', enumId: id }
          });
        } else {
          setDirty(false);
        }
      } else if (isNew) {
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
    isDraftMode,
    schemaDraft,
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
      if (isDraftMode) {
        if (schemaDraft.itemFor('enum', selected.id)?.op === 'create') {
          await schemaDraft.unstage('enum', selected.id);
        } else {
          await schemaDraft.stage('enum', selected.id, 'delete');
        }
      } else {
        await deleteEnumMutation.mutateAsync(selected.id);
      }
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'enums' }
      });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to delete enum');
    }
  }, [selected, isDraftMode, schemaDraft, deleteEnumMutation, navigate, workspaceSlug]);

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
    isStaged: selected ? schemaDraft.isStaged('enum', selected.id) : false,
    revertToLive: async () => {
      if (selected) await schemaDraft.unstage('enum', selected.id);
    },
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
