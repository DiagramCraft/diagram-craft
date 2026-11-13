import { useMemo, useRef } from 'react';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { Category } from '@arch-register/api-types/categoryContract';
import { applyPayload, blankCategory, overlayDraftItems } from './schemaDraftOverlay';
import { useSchemaDraftState, type SchemaDraftKind } from './useSchemaDraftState';

/** Workspace categories with staged category creates and renames applied. */
export const useDraftCategories = (): Category[] => {
  const { categories } = useWorkspaceContext();
  const { draft } = useSchemaDraftState();
  return useMemo(() => {
    const items = (draft?.items ?? []).filter(i => i.kind === 'category');
    if (items.length === 0) return categories;
    const workspaceId = categories[0]?.workspaceId ?? '';
    return overlayDraftItems(categories, items, (payload, existing, id) =>
      applyPayload(existing ?? blankCategory(id, workspaceId), payload, [])
    ).map(({ item }) => item);
  }, [categories, draft]);
};

/**
 * Returns the live list with staged draft updates applied and staged creates appended. Staged
 * deletes keep the live item (callers flag them via `isStaged`). Only for the settings editors;
 * live consumers keep reading `WorkspaceContext` directly.
 */
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
    return overlayDraftItems(live, items, (payload, existing, id) =>
      applyPayload(existing ?? blankRef.current(id), payload, categories)
    ).map(({ item }) => item);
  }, [kind, live, draft, categories]);
};
