import { useEffect, useRef, useState } from 'react';
import type {
  DocumentAiAction,
  DocumentField,
  DocumentType,
  FieldMigrations,
  PendingFieldChange
} from '@arch-register/api-types/documentContract';
import {
  useArchiveDocumentType,
  useCreateDocumentType,
  useDeleteDocumentType,
  useUpdateDocumentType
} from '../../hooks/useDocuments';
import { getDocumentTypeMigrationRequired } from '../../queries/documents';
import type { FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';
import { moveInArray } from '../../utils/arrayReorder';

export const NEW_DOCUMENT_TYPE_ID = 'new';

const newDocumentField = (existingIds: ReadonlySet<string> = new Set<string>()): DocumentField => {
  let id = 'new_field';
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `new_field_${suffix}`;
    suffix += 1;
  }
  return {
    id,
    name: id,
    type: 'text',
    requirement: 'optional',
    retired: false
  };
};

/**
 * Draft state and persistence for the document type editor: edits, dirty tracking, revert, save
 * (with field migrations), archive and delete. Presentation stays in `DocumentTypeEditor`.
 */
export const useDocumentTypeDraft = ({
  workspaceSlug,
  selected,
  isNew,
  onSelect,
  onDeleted
}: {
  workspaceSlug: string;
  selected: DocumentType | null;
  isNew: boolean;
  onSelect: (id: string) => void;
  onDeleted: () => void;
}) => {
  const createType = useCreateDocumentType(workspaceSlug);
  const updateType = useUpdateDocumentType(workspaceSlug);
  const archiveType = useArchiveDocumentType(workspaceSlug);
  const deleteType = useDeleteDocumentType(workspaceSlug);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [aiActions, setAiActions] = useState<DocumentAiAction[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingFieldChanges, setPendingFieldChanges] = useState<PendingFieldChange[] | null>(null);
  const fieldKeysRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    fieldKeysRef.current.clear();
    if (selected) {
      selected.fields.forEach(field => fieldKeysRef.current.set(field.id, crypto.randomUUID()));
      setName(selected.name);
      setDescription(selected.description);
      setFields(selected.fields);
      setAiActions(selected.aiActions);
      setColor(selected.color);
      setIcon(selected.icon);
      setDirty(false);
      setShowHistory(false);
      setPendingFieldChanges(null);
    } else if (isNew) {
      setName('');
      setDescription('');
      setFields([]);
      setAiActions([]);
      setColor(null);
      setIcon(null);
      setDirty(true);
    }
  }, [isNew, selected]);

  const updateField = (fieldId: string, patch: Partial<DocumentField>) => {
    if (patch.id !== undefined && patch.id !== fieldId) {
      const stableKey = fieldKeysRef.current.get(fieldId);
      if (stableKey) {
        fieldKeysRef.current.delete(fieldId);
        fieldKeysRef.current.set(patch.id, stableKey);
      }
    }
    setFields(current =>
      current.map(field =>
        field.id === fieldId ? ({ ...field, ...patch } as DocumentField) : field
      )
    );
    setDirty(true);
  };

  const removeField = (field: DocumentField) => {
    fieldKeysRef.current.delete(field.id);
    setFields(current => current.filter(item => item.id !== field.id));
    setDirty(true);
  };

  const addField = () => {
    const field = newDocumentField(new Set(fields.map(item => item.id)));
    fieldKeysRef.current.set(field.id, crypto.randomUUID());
    setFields(current => [...current, field]);
    setDirty(true);
  };

  const reorderFields = (fromIndex: number, toIndex: number) => {
    setFields(current => moveInArray(current, fromIndex, toIndex));
    setDirty(true);
  };

  const handleSave = async (fieldMigrations?: FieldMigrations) => {
    if (!dirty) return;
    try {
      const body = { name, description, fields, aiActions, color, icon, fieldMigrations };
      if (isNew) {
        const created = await createType.mutateAsync(body);
        onSelect(created.id);
      } else if (selected) {
        await updateType.mutateAsync({ id: selected.id, body });
        setDirty(false);
        setPendingFieldChanges(null);
      } else {
        return;
      }
    } catch (cause) {
      const migrationRequired = getDocumentTypeMigrationRequired(cause);
      if (migrationRequired) {
        setPendingFieldChanges(migrationRequired.pendingChanges);
        return;
      }
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to save document type');
    }
  };

  const confirmFieldMigrations = (choices: FieldMigrationChoices) => {
    if (!pendingFieldChanges) return;
    const fieldMigrations: FieldMigrations = {};
    for (const change of pendingFieldChanges) {
      const action = choices[change.fieldId] ?? 'remove';
      fieldMigrations[change.fieldId] =
        action === 'rename' ? { action, renameTo: change.renamedToId } : { action };
    }
    void handleSave(fieldMigrations);
  };

  const doDelete = async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await deleteType.mutateAsync(selected.id);
      onDeleted();
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to delete document type');
    }
  };

  const revert = () => {
    fieldKeysRef.current.clear();
    if (selected) {
      selected.fields.forEach(field => fieldKeysRef.current.set(field.id, crypto.randomUUID()));
      setName(selected.name);
      setDescription(selected.description);
      setFields(selected.fields);
      setAiActions(selected.aiActions);
      setColor(selected.color);
      setIcon(selected.icon);
      setDirty(false);
    } else if (isNew) {
      setName('');
      setDescription('');
      setFields([]);
      setAiActions([]);
      setColor(null);
      setIcon(null);
      setDirty(true);
    }
    setPendingFieldChanges(null);
    setErrorMessage(null);
  };

  const edit =
    <T>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setDirty(true);
    };

  return {
    name,
    description,
    fields,
    aiActions,
    color,
    icon,
    dirty,
    fieldKeys: fieldKeysRef.current,
    isSaving: createType.isPending || updateType.isPending,
    confirmDelete,
    setConfirmDelete,
    errorMessage,
    setErrorMessage,
    showHistory,
    setShowHistory,
    pendingFieldChanges,
    setPendingFieldChanges,
    setName: edit(setName),
    setDescription: edit(setDescription),
    setColor: edit(setColor),
    setIcon: edit(setIcon),
    setAiActions: edit(setAiActions),
    updateField,
    removeField,
    addField,
    reorderFields,
    confirmFieldMigrations,
    toggleArchived: () =>
      selected ? archiveType.mutateAsync({ id: selected.id, archived: !selected.archived }) : null,
    revert,
    save: handleSave,
    remove: doDelete
  };
};
