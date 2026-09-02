import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  FieldMigrationAction,
  FieldMigrations,
  PendingFieldChange,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
import type { RelationConstraintErrorData } from '@arch-register/api-types/relationSchemaContract';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import type { FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';
import { toFieldId } from '../../utils/fieldId';
import { moveWithinBucket } from '../../utils/arrayReorder';

export type EditorField = {
  id: string;
  name: string;
  groupId?: string;
};

export type EditorGroup = {
  id: string;
  name: string;
  description?: string;
  accessControl?: { teamIds: string[] };
};

export type SchemaEditorDraft<
  Field extends EditorField,
  Group extends EditorGroup,
  Extra extends object = Record<never, never>
> = {
  name: string;
  description: string;
  fields: Field[];
  groups: Group[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  validationRules: ValidationRule[];
  color: string | null;
  icon: string | null;
} & Extra;

export type SchemaEditorAdapter<
  Selected extends { id: string },
  Field extends EditorField,
  Group extends EditorGroup,
  Extra extends object = Record<never, never>,
  FieldType extends string = string
> = {
  createDraft: (selected: Selected | null) => SchemaEditorDraft<Field, Group, Extra>;
  createField: (id: string, groupId?: string) => Field;
  changeFieldType: (
    field: Field,
    newType: FieldType,
    fields: Field[],
    firstEnumId?: string
  ) => Field;
  onFieldIdChange?: (
    draft: SchemaEditorDraft<Field, Group, Extra>,
    previousFieldId: string,
    nextFieldId: string
  ) => SchemaEditorDraft<Field, Group, Extra>;
  onFieldRemoved?: (
    draft: SchemaEditorDraft<Field, Group, Extra>,
    fieldId: string
  ) => SchemaEditorDraft<Field, Group, Extra>;
  onFieldTypeChanged?: (
    draft: SchemaEditorDraft<Field, Group, Extra>,
    fieldId: string
  ) => SchemaEditorDraft<Field, Group, Extra>;
  hasChanges?: (draft: SchemaEditorDraft<Field, Group, Extra>, selected: Selected) => boolean;
  save: (
    selected: Selected,
    draft: SchemaEditorDraft<Field, Group, Extra>,
    fieldMigrations?: FieldMigrations
  ) => Promise<void>;
  create: (draft: SchemaEditorDraft<Field, Group, Extra>) => Promise<{ id: string }>;
  isValid?: (draft: SchemaEditorDraft<Field, Group, Extra>) => boolean;
  remove: (selected: Selected) => Promise<void>;
  getMigrationRequired: (error: unknown) => { pendingChanges: PendingFieldChange[] } | null;
  getConstraintViolation?: (error: unknown) => RelationConstraintErrorData | null;
  validationRuleDefaults: () => ValidationRule;
  selectAfterDelete: (items: Selected[], deletedId: string) => string;
  labels: {
    subject: string;
    itemNoun: string;
    deleteTitle: string;
    deleteConfirmLabel: string;
    saveError: string;
    createError: string;
    deleteError: string;
  };
};

export type SchemaEditorController<
  Selected extends { id: string },
  Field extends EditorField,
  Group extends EditorGroup,
  Extra extends object = Record<never, never>,
  FieldType extends string = string
> = {
  selected: Selected | null;
  draft: SchemaEditorDraft<Field, Group, Extra> | null;
  setDraft: Dispatch<SetStateAction<SchemaEditorDraft<Field, Group, Extra> | null>>;
  updateDraft: (
    updater: (
      draft: SchemaEditorDraft<Field, Group, Extra>
    ) => SchemaEditorDraft<Field, Group, Extra>
  ) => void;
  dirty: boolean;
  fieldKeys: ReadonlyMap<string, string>;
  showHistory: boolean;
  setShowHistory: Dispatch<SetStateAction<boolean>>;
  pendingFieldChanges: PendingFieldChange[] | null;
  confirmDelete: boolean;
  errorMessage: string | null;
  constraintViolations: RelationConstraintErrorData | null;
  groupDialogOpen: boolean;
  editingGroup: Group | null;
  accessDialogGroupId: string | null;
  setAccessDialogGroupId: Dispatch<SetStateAction<string | null>>;
  setConfirmDelete: Dispatch<SetStateAction<boolean>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setConstraintViolations: Dispatch<SetStateAction<RelationConstraintErrorData | null>>;
  setPendingFieldChanges: Dispatch<SetStateAction<PendingFieldChange[] | null>>;
  setGroupDialogOpen: Dispatch<SetStateAction<boolean>>;
  setEditingGroup: Dispatch<SetStateAction<Group | null>>;
  addField: (groupId?: string) => void;
  updateField: (fieldId: string, patch: Partial<Field>) => void;
  changeFieldType: (fieldId: string, newType: FieldType) => void;
  removeField: (fieldId: string) => void;
  reorderFields: (bucketFieldIds: string[], fromIndex: number, toIndex: number) => void;
  addValidationRule: () => void;
  updateValidationRule: (index: number, patch: Partial<ValidationRule>) => void;
  toggleValidationRule: (index: number) => void;
  deleteValidationRule: (index: number) => void;
  addSharedFieldGroup: (groupId: string | undefined) => void;
  removeSharedFieldGroup: (groupId: string) => void;
  setGroupAccess: (groupId: string, teamIds: string[]) => void;
  saveGroup: (group: Group) => void;
  removeGroup: (groupId: string) => void;
  save: (fieldMigrations?: FieldMigrations) => Promise<void>;
  confirmFieldMigrations: (choices: FieldMigrationChoices) => void;
  deleteSelected: () => Promise<void>;
};

export const buildFieldMigrations = (
  pendingChanges: PendingFieldChange[],
  choices: Record<string, FieldMigrationAction['action']>
): FieldMigrations => {
  const migrations: FieldMigrations = {};
  for (const change of pendingChanges) {
    const action = choices[change.fieldId] ?? 'remove';
    migrations[change.fieldId] =
      action === 'rename' ? { action, renameTo: change.renamedToId } : { action };
  }
  return migrations;
};

export const firstRemainingId = <T extends { id: string }>(items: T[], deletedId: string): string =>
  items.find(item => item.id !== deletedId)?.id ?? '';

type Options<
  Selected extends { id: string },
  Field extends EditorField,
  Group extends EditorGroup,
  Extra extends object,
  FieldType extends string
> = {
  selected: Selected | null;
  isNew: boolean;
  items: Selected[];
  fieldGroups: SharedFieldGroup[];
  firstEnumId?: string;
  adapter: SchemaEditorAdapter<Selected, Field, Group, Extra, FieldType>;
  onSelect: (id: string) => void;
};

export const useSchemaEditorController = <
  Selected extends { id: string },
  Field extends EditorField,
  Group extends EditorGroup,
  Extra extends object = Record<never, never>,
  FieldType extends string = string
>({
  selected,
  isNew,
  items,
  fieldGroups,
  firstEnumId,
  adapter,
  onSelect
}: Options<Selected, Field, Group, Extra, FieldType>): SchemaEditorController<
  Selected,
  Field,
  Group,
  Extra,
  FieldType
> => {
  const [draft, setDraft] = useState<SchemaEditorDraft<Field, Group, Extra> | null>(() =>
    selected ? adapter.createDraft(selected) : isNew ? adapter.createDraft(null) : null
  );
  const [dirty, setDirty] = useState(isNew);
  const [pendingFieldChanges, setPendingFieldChanges] = useState<PendingFieldChange[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [constraintViolations, setConstraintViolations] =
    useState<RelationConstraintErrorData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [accessDialogGroupId, setAccessDialogGroupId] = useState<string | null>(null);
  const fieldKeysRef = useRef<Map<string, string>>(new Map());
  const adapterRef = useRef(adapter);
  const selectedIdRef = useRef(selected?.id);
  const isNewRef = useRef(isNew);
  adapterRef.current = adapter;
  selectedIdRef.current = selected?.id;
  isNewRef.current = isNew;

  const resetTransientState = useCallback(() => {
    setDirty(false);
    setPendingFieldChanges(null);
    setConfirmDelete(false);
    setErrorMessage(null);
    setConstraintViolations(null);
    setShowHistory(false);
    setGroupDialogOpen(false);
    setEditingGroup(null);
    setAccessDialogGroupId(null);
    fieldKeysRef.current.clear();
  }, []);

  useEffect(() => {
    if (selected) {
      setDraft(adapterRef.current.createDraft(selected));
      resetTransientState();
      return;
    }
    if (isNew) {
      setDraft(adapterRef.current.createDraft(null));
      resetTransientState();
      setDirty(true);
      return;
    }
    setDraft(null);
    resetTransientState();
  }, [selected, isNew, resetTransientState]);

  const updateDraft = useCallback(
    (
      updater: (
        current: SchemaEditorDraft<Field, Group, Extra>
      ) => SchemaEditorDraft<Field, Group, Extra>
    ) => {
      setDraft(current => (current ? updater(current) : current));
      setDirty(true);
    },
    []
  );

  const addField = useCallback(
    (groupId?: string) => {
      const id = toFieldId('new_field');
      fieldKeysRef.current.set(id, crypto.randomUUID());
      updateDraft(current => ({
        ...current,
        fields: [...current.fields, adapterRef.current.createField(id, groupId)]
      }));
    },
    [updateDraft]
  );

  const updateField = useCallback(
    (fieldId: string, patch: Partial<Field>) => {
      updateDraft(current => {
        let next = {
          ...current,
          fields: current.fields.map(field =>
            field.id === fieldId ? ({ ...field, ...patch } as Field) : field
          )
        };
        if (patch.id && patch.id !== fieldId) {
          const stableKey = fieldKeysRef.current.get(fieldId);
          if (stableKey) {
            fieldKeysRef.current.delete(fieldId);
            fieldKeysRef.current.set(patch.id, stableKey);
          }
          next = adapterRef.current.onFieldIdChange?.(next, fieldId, patch.id) ?? next;
        }
        return next;
      });
    },
    [updateDraft]
  );

  const changeFieldType = useCallback(
    (fieldId: string, newType: FieldType) => {
      updateDraft(current => {
        const field = current.fields.find(item => item.id === fieldId);
        if (!field) return current;
        const changed = adapterRef.current.changeFieldType(
          field,
          newType,
          current.fields,
          firstEnumId
        );
        const next = {
          ...current,
          fields: current.fields.map(item => (item.id === fieldId ? changed : item))
        };
        return adapterRef.current.onFieldTypeChanged?.(next, fieldId) ?? next;
      });
    },
    [firstEnumId, updateDraft]
  );

  const removeField = useCallback(
    (fieldId: string) => {
      updateDraft(current => {
        const next = { ...current, fields: current.fields.filter(field => field.id !== fieldId) };
        fieldKeysRef.current.delete(fieldId);
        return adapterRef.current.onFieldRemoved?.(next, fieldId) ?? next;
      });
    },
    [updateDraft]
  );

  const reorderFields = useCallback(
    (bucketFieldIds: string[], fromIndex: number, toIndex: number) => {
      updateDraft(current => ({
        ...current,
        fields: moveWithinBucket(current.fields, bucketFieldIds, fromIndex, toIndex)
      }));
    },
    [updateDraft]
  );

  const addValidationRule = useCallback(() => {
    updateDraft(current => ({
      ...current,
      validationRules: [...current.validationRules, adapterRef.current.validationRuleDefaults()]
    }));
  }, [updateDraft]);

  const updateValidationRule = useCallback(
    (index: number, patch: Partial<ValidationRule>) => {
      updateDraft(current => ({
        ...current,
        validationRules: current.validationRules.map((rule, ruleIndex) =>
          ruleIndex === index ? { ...rule, ...patch } : rule
        )
      }));
    },
    [updateDraft]
  );

  const toggleValidationRule = useCallback(
    (index: number) => {
      updateDraft(current => ({
        ...current,
        validationRules: current.validationRules.map((rule, ruleIndex) =>
          ruleIndex === index ? { ...rule, active: !rule.active } : rule
        )
      }));
    },
    [updateDraft]
  );

  const deleteValidationRule = useCallback(
    (index: number) => {
      updateDraft(current => ({
        ...current,
        validationRules: current.validationRules.filter((_, ruleIndex) => ruleIndex !== index)
      }));
    },
    [updateDraft]
  );

  const addSharedFieldGroup = useCallback(
    (groupId: string | undefined) => {
      if (!groupId) return;
      const sharedGroup = fieldGroups.find(group => group.id === groupId);
      if (!sharedGroup) return;
      updateDraft(current => {
        if (current.sharedFieldGroupLinks.some(link => link.groupId === groupId)) return current;
        return {
          ...current,
          sharedFieldGroupLinks: [...current.sharedFieldGroupLinks, { groupId }],
          groups: [
            ...current.groups,
            {
              id: sharedGroup.id,
              name: sharedGroup.name,
              ...(sharedGroup.description ? { description: sharedGroup.description } : {})
            } as Group
          ]
        };
      });
    },
    [fieldGroups, updateDraft]
  );

  const removeSharedFieldGroup = useCallback(
    (groupId: string) => {
      updateDraft(current => ({
        ...current,
        sharedFieldGroupLinks: current.sharedFieldGroupLinks.filter(
          link => link.groupId !== groupId
        ),
        groups: current.groups.filter(group => group.id !== groupId)
      }));
    },
    [updateDraft]
  );

  const setGroupAccess = useCallback(
    (groupId: string, teamIds: string[]) => {
      updateDraft(current => {
        if (current.sharedFieldGroupLinks.some(link => link.groupId === groupId)) {
          return {
            ...current,
            sharedFieldGroupLinks: current.sharedFieldGroupLinks.map(link =>
              link.groupId === groupId
                ? { groupId, ...(teamIds.length > 0 ? { teamIds } : {}) }
                : link
            )
          };
        }
        return {
          ...current,
          groups: current.groups.map(group => {
            if (group.id !== groupId) return group;
            const nextGroup = { ...group };
            delete nextGroup.accessControl;
            if (teamIds.length > 0) nextGroup.accessControl = { teamIds };
            return nextGroup;
          })
        };
      });
    },
    [updateDraft]
  );

  const saveGroup = useCallback(
    (group: Group) => {
      updateDraft(current => ({
        ...current,
        groups: current.groups.some(item => item.id === group.id)
          ? current.groups.map(item => (item.id === group.id ? group : item))
          : [...current.groups, group]
      }));
      setGroupDialogOpen(false);
    },
    [updateDraft]
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      updateDraft(current => ({
        ...current,
        groups: current.groups.filter(group => group.id !== groupId),
        fields: current.fields.map(field =>
          field.groupId === groupId ? { ...field, groupId: undefined } : field
        )
      }));
    },
    [updateDraft]
  );

  const save = useCallback(
    async (fieldMigrations?: FieldMigrations) => {
      if (!draft || (!dirty && fieldMigrations === undefined)) return;
      if (!selected && !isNewRef.current) return;
      try {
        if (!selected) {
          const created = await adapterRef.current.create(draft);
          onSelect(created.id);
          return;
        }
        const shouldSave =
          fieldMigrations !== undefined ||
          adapterRef.current.hasChanges?.(draft, selected) !== false;
        if (shouldSave) await adapterRef.current.save(selected, draft, fieldMigrations);
        if (selectedIdRef.current === selected.id) {
          setDirty(false);
          setPendingFieldChanges(null);
        }
      } catch (error: unknown) {
        const migrationRequired = adapterRef.current.getMigrationRequired(error);
        if (migrationRequired) {
          setPendingFieldChanges(migrationRequired.pendingChanges);
          return;
        }
        const constraintViolation = adapterRef.current.getConstraintViolation?.(error);
        if (constraintViolation) {
          setConstraintViolations(constraintViolation);
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : selected
              ? adapterRef.current.labels.saveError
              : adapterRef.current.labels.createError
        );
      }
    },
    [dirty, draft, selected, onSelect]
  );

  const confirmFieldMigrations = useCallback(
    (choices: FieldMigrationChoices) => {
      if (!pendingFieldChanges) return;
      void save(buildFieldMigrations(pendingFieldChanges, choices));
    },
    [pendingFieldChanges, save]
  );

  const deleteSelected = useCallback(async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await adapterRef.current.remove(selected);
      onSelect(adapterRef.current.selectAfterDelete(items, selected.id));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : adapterRef.current.labels.deleteError
      );
    }
  }, [items, onSelect, selected]);

  return {
    selected,
    draft,
    setDraft,
    updateDraft,
    dirty,
    fieldKeys: fieldKeysRef.current,
    showHistory,
    setShowHistory,
    pendingFieldChanges,
    confirmDelete,
    errorMessage,
    constraintViolations,
    groupDialogOpen,
    editingGroup,
    accessDialogGroupId,
    setAccessDialogGroupId,
    setConfirmDelete,
    setErrorMessage,
    setConstraintViolations,
    setPendingFieldChanges,
    setGroupDialogOpen,
    setEditingGroup,
    addField,
    updateField,
    changeFieldType,
    removeField,
    reorderFields,
    addValidationRule,
    updateValidationRule,
    toggleValidationRule,
    deleteValidationRule,
    addSharedFieldGroup,
    removeSharedFieldGroup,
    setGroupAccess,
    saveGroup,
    removeGroup,
    save,
    confirmFieldMigrations,
    deleteSelected
  };
};
