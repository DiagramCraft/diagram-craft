import { useMemo, useRef } from 'react';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { Category } from '@arch-register/api-types/categoryContract';
import { applyPayload } from './schemaDraftOverlay';
import { useSchemaDraftState, type SchemaDraftKind } from './useSchemaDraftState';

/**
 * Returns the live list with staged draft updates applied and staged creates appended. Staged
 * deletes keep the live item (callers flag them via `isStaged`). Only for the settings editors;
 * live consumers keep reading `WorkspaceContext` directly.
 */
/** Workspace categories with staged category creates and renames applied. */
export const useDraftCategories = (): Category[] => {
  const { categories } = useWorkspaceContext();
  const { draft } = useSchemaDraftState();
  return useMemo(() => {
    const items = (draft?.items ?? []).filter(i => i.kind === 'category');
    if (items.length === 0) return categories;
    const byId = new Map(items.map(i => [i.item_id, i]));
    const merged = categories.map(c => {
      const staged = byId.get(c.id);
      return staged && staged.op !== 'delete' ? applyPayload(c, staged.payload, []) : c;
    });
    const liveIds = new Set(categories.map(c => c.id));
    const now = new Date().toISOString();
    for (const staged of items) {
      if (staged.op === 'create' && !liveIds.has(staged.item_id)) {
        merged.push(
          applyPayload(
            {
              id: staged.item_id,
              workspaceId: categories[0]?.workspaceId ?? '',
              name: '',
              createdAt: now,
              updatedAt: now
            } as Category,
            staged.payload,
            []
          )
        );
      }
    }
    return merged;
  }, [categories, draft]);
};

export const useDraftOverlay = <T extends { id: string }>(
  kind: SchemaDraftKind,
  live: T[],
  blank: (id: string) => T
): T[] => {
  const categories = useDraftCategories();
  const { draft } = useSchemaDraftState();
  // Callers pass inline arrows; keep the memo (and the item identities editors key on) stable.
  const blankRef = useRef(blank);
  blankRef.current = blank;
  return useMemo(() => {
    const items = (draft?.items ?? []).filter(i => i.kind === kind);
    if (items.length === 0) return live;
    const byId = new Map(items.map(i => [i.item_id, i]));
    const merged = live.map(item => {
      const staged = byId.get(item.id);
      return staged && staged.op !== 'delete'
        ? applyPayload(item, staged.payload, categories)
        : item;
    });
    const liveIds = new Set(live.map(l => l.id));
    for (const staged of items) {
      if (staged.op === 'create' && !liveIds.has(staged.item_id)) {
        merged.push(applyPayload(blankRef.current(staged.item_id), staged.payload, categories));
      }
    }
    return merged;
  }, [kind, live, draft, categories]);
};
