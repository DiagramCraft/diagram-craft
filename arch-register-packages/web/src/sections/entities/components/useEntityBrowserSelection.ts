import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateEntity } from '../../../hooks/useEntities';
import { orpcClient } from '../../../lib/orpcClient';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { canClearBulkField, getBulkEditableFields, type BulkEditableField } from './bulkEditFields';
import { useCancellableTimeout } from '../../../hooks/useCancellableTimeout';

export type BulkFieldRow = {
  rowId: string;
  fieldId: string;
  value: string;
  clearing: boolean;
};

export type BulkEditStep = 'edit' | 'confirm' | 'done';

export type BulkEditSkip = { entity: EntityRecord; reason: string };

export type BulkEditResult = {
  applied: EntityRecord[];
  skipped: BulkEditSkip[];
};

type UseEntityBrowserSelectionProps = {
  workspaceId: string;
  entities: EntityRecord[];
  filtered: EntityRecord[];
  filteredCount: number;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
};

const buildBaseMutationBody = (
  entity: EntityRecord,
  schema: EntitySchema | undefined
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    _schema: entity._schema,
    _name: entity._name,
    _slug: entity._slug,
    _namespace: entity._namespace,
    _description: entity._description,
    _owner: entity._owner,
    _lifecycle: entity._lifecycle,
    _targetLifecycle: entity._targetLifecycle,
    _targetLifecycleDate: entity._targetLifecycleDate,
    _tags: entity._tags,
    _links: entity._links,
    _projectId: entity._projectId
  };

  for (const field of schema?.fields ?? []) {
    body[field.id] =
      field.type === 'reference' || field.type === 'containment'
        ? Array.isArray(entity[field.id])
          ? entity[field.id]
          : []
        : (entity[field.id] ?? '');
  }

  return body;
};

const applyFieldRowToBody = (
  body: Record<string, unknown>,
  row: BulkFieldRow,
  field: BulkEditableField
) => {
  if (field.kind === 'owner' || field.kind === 'lifecycle') {
    body[field.id] = row.clearing ? null : row.value;
    return;
  }
  if (field.field.type === 'reference') {
    body[field.id] = row.clearing ? [] : [row.value];
    return;
  }
  if (field.field.type === 'boolean') {
    body[field.id] = row.clearing ? null : row.value === 'true';
    return;
  }
  if (field.field.type === 'number') {
    body[field.id] = row.clearing ? null : Number(row.value);
    return;
  }
  body[field.id] = row.clearing ? null : row.value;
};

export const useEntityBrowserSelection = ({
  workspaceId,
  entities,
  filtered,
  filteredCount,
  schemaMap
}: UseEntityBrowserSelectionProps) => {
  const updateEntityMutation = useUpdateEntity(workspaceId);
  const previousFilteredCountRef = useRef(0);
  const { cancel, schedule } = useCancellableTimeout();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fieldRows, setFieldRows] = useState<BulkFieldRow[]>([]);
  const [step, setStep] = useState<BulkEditStep>('edit');
  const [result, setResult] = useState<BulkEditResult | null>(null);

  const clearSelection = useCallback(() => {
    cancel();
    setSelectedIds(new Set());
    setFieldRows([]);
    setStep('edit');
    setResult(null);
  }, [cancel]);

  useEffect(() => {
    if (previousFilteredCountRef.current !== filteredCount) {
      previousFilteredCountRef.current = filteredCount;
      setSelectedIds(new Set());
    }
  }, [filteredCount]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map(entity => entity._uid)));
  }, [filtered, selectedIds.size]);

  const handleSelectRow = useCallback((uid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const selectedEntities = useMemo(
    () => entities.filter(entity => selectedIds.has(entity._uid)),
    [entities, selectedIds]
  );

  const availableFields = useMemo(
    () => getBulkEditableFields(selectedEntities, schemaMap),
    [selectedEntities, schemaMap]
  );

  const addFieldRow = useCallback((fieldId: string) => {
    setFieldRows(prev => [
      ...prev,
      { rowId: `${Date.now()}-${Math.random()}`, fieldId, value: '', clearing: false }
    ]);
  }, []);

  const updateFieldRow = useCallback((rowId: string, changes: Partial<BulkFieldRow>) => {
    setFieldRows(prev => prev.map(row => (row.rowId === rowId ? { ...row, ...changes } : row)));
  }, []);

  const removeFieldRow = useCallback((rowId: string) => {
    setFieldRows(prev => prev.filter(row => row.rowId !== rowId));
  }, []);

  const handleConfirm = useCallback(async () => {
    cancel();

    const permSkipped: BulkEditSkip[] = selectedEntities
      .filter(entity => entity.canEdit === false)
      .map(entity => ({ entity, reason: 'No edit permission' }));
    const editable = selectedEntities.filter(entity => entity.canEdit !== false);

    const applied: EntityRecord[] = [];
    const skipped: BulkEditSkip[] = [...permSkipped];

    for (const entity of editable) {
      try {
        const schema = schemaMap.get(entity._schema.id)?.schema;
        const fullEntity = await orpcClient.entities.get({
          params: { workspace: workspaceId, id: entity._uid }
        });
        const body = buildBaseMutationBody(fullEntity, schema);
        for (const row of fieldRows) {
          if (!row.clearing && row.value === '') continue;
          const field = availableFields.find(f => f.id === row.fieldId);
          if (!field) continue;
          applyFieldRowToBody(body, row, field);
        }
        const updated = await updateEntityMutation.mutateAsync({
          entityId: entity._uid,
          data: body
        });
        applied.push(updated);
      } catch (error) {
        skipped.push({
          entity,
          reason: error instanceof Error ? error.message : 'Failed to update entity'
        });
      }
    }

    setResult({ applied, skipped });
    setStep('done');
    if (skipped.length === 0) {
      schedule(clearSelection, 1800);
    }
  }, [
    selectedEntities,
    schemaMap,
    fieldRows,
    availableFields,
    updateEntityMutation,
    workspaceId,
    clearSelection,
    cancel,
    schedule
  ]);

  return {
    addFieldRow,
    availableFields,
    canClearBulkField,
    clearSelection,
    fieldRows,
    handleConfirm,
    handleSelectAll,
    handleSelectRow,
    removeFieldRow,
    result,
    selectedEntities,
    selectedIds,
    setStep,
    step,
    updateFieldRow
  };
};
