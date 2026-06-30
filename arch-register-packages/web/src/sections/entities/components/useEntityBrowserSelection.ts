import { useCallback, useEffect, useRef, useState } from 'react';
import { useUpdateEntity } from '../../../hooks/useEntities';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
type UseEntityBrowserSelectionProps = {
  workspaceId: string;
  entities: EntityRecord[];
  filtered: EntityRecord[];
  filteredCount: number;
};

export const useEntityBrowserSelection = ({
  workspaceId,
  entities,
  filtered,
  filteredCount
}: UseEntityBrowserSelectionProps) => {
  const updateEntityMutation = useUpdateEntity(workspaceId);
  const previousFilteredCountRef = useRef(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkLifecycleValue, setBulkLifecycleValue] = useState('');
  const [bulkOwnerValue, setBulkOwnerValue] = useState('');

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkLifecycleValue('');
    setBulkOwnerValue('');
    setBulkConfirming(false);
  }, []);

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

  const doBulkUpdate = useCallback(async () => {
    const targets = entities.filter(entity => selectedIds.has(entity._uid));
    for (const entity of targets) {
      await updateEntityMutation.mutateAsync({
        entityId: entity._uid,
        data: {
          ...entity,
          ...(bulkLifecycleValue ? { _lifecycle: bulkLifecycleValue } : {}),
          ...(bulkOwnerValue ? { _owner: bulkOwnerValue } : {})
        }
      });
    }

    clearSelection();
  }, [
    bulkLifecycleValue,
    bulkOwnerValue,
    clearSelection,
    entities,
    selectedIds,
    updateEntityMutation
  ]);

  return {
    bulkConfirming,
    bulkLifecycleValue,
    bulkOwnerValue,
    clearSelection,
    doBulkUpdate,
    handleSelectAll,
    handleSelectRow,
    selectedIds,
    setBulkConfirming,
    setBulkLifecycleValue,
    setBulkOwnerValue
  };
};
