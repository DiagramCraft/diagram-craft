import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { EntityDrawerSearchParams } from '../../../routes/searchParams';

export type EntityDrawerStackEntry =
  | { kind: 'entity'; entityId: string }
  | { kind: 'case'; caseId: string }
  | { kind: 'project'; projectId: string };

const sameEntry = (a: EntityDrawerStackEntry, b: EntityDrawerStackEntry): boolean => {
  if (a.kind === 'entity') return b.kind === 'entity' && a.entityId === b.entityId;
  if (a.kind === 'case') return b.kind === 'case' && a.caseId === b.caseId;
  return b.kind === 'project' && a.projectId === b.projectId;
};

export type EntityDrawerController = {
  drawerEntityId: string | undefined;
  drawerStack: readonly EntityDrawerStackEntry[];
  activeDrawerIndex: number;
  openEntityDrawer: (entityId: string) => void;
  openCaseDrawer: (caseId: string) => void;
  openProjectDrawer: (projectId: string) => void;
  backEntityDrawer: () => void;
  closeEntityDrawer: () => void;
};

const activeEntityId = (entry: EntityDrawerStackEntry | undefined): string | undefined =>
  entry?.kind === 'entity' ? entry.entityId : undefined;

const EntityDrawerStackContext = createContext<EntityDrawerController | null>(null);

/**
 * Provides the workspace-local entity drawer stack. Opening, navigating within, and closing the
 * stack is purely local state — the URL is never rewritten by these interactions, so it stays
 * whatever the user was already looking at. The one exception is a drawer that arrived via a
 * shared `drawer=<id>` link on page load: fully closing it clears that param (via a history
 * replace) so a later refresh or back navigation doesn't reopen it. `EntityDrawer`'s own copy-link
 * action is the supported way to put a `drawer=<id>` URL back on the clipboard for sharing.
 */
export const EntityDrawerStackProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as EntityDrawerSearchParams;
  const initialStack: readonly EntityDrawerStackEntry[] = search.drawer
    ? [{ kind: 'entity', entityId: search.drawer }]
    : [];
  const [drawerStack, setDrawerStack] = useState<readonly EntityDrawerStackEntry[]>(initialStack);
  const [activeDrawerIndex, setActiveDrawerIndex] = useState(search.drawer ? 0 : -1);
  const stackRef = useRef<readonly EntityDrawerStackEntry[]>(initialStack);
  const activeIndexRef = useRef(search.drawer ? 0 : -1);
  const linkedEntityIdRef = useRef(search.drawer);

  const commitStack = useCallback(
    (nextStack: readonly EntityDrawerStackEntry[], nextIndex: number) => {
      stackRef.current = nextStack;
      activeIndexRef.current = nextIndex;
      setDrawerStack(nextStack);
      setActiveDrawerIndex(nextIndex);
    },
    []
  );

  const openEntry = useCallback(
    (entry: EntityDrawerStackEntry) => {
      const currentIndex = activeIndexRef.current;
      const visibleStack = stackRef.current.slice(0, currentIndex + 1);
      const existingIndex = visibleStack.findIndex(candidate => sameEntry(candidate, entry));
      const nextStack = existingIndex >= 0 ? visibleStack : [...visibleStack, entry];
      const nextIndex = existingIndex >= 0 ? existingIndex : nextStack.length - 1;

      commitStack(nextStack, nextIndex);
    },
    [commitStack]
  );

  const openEntityDrawer = useCallback(
    (entityId: string) => {
      if (entityId) openEntry({ kind: 'entity', entityId });
    },
    [openEntry]
  );

  const openCaseDrawer = useCallback(
    (caseId: string) => {
      if (caseId) openEntry({ kind: 'case', caseId });
    },
    [openEntry]
  );

  const openProjectDrawer = useCallback(
    (projectId: string) => {
      if (projectId) openEntry({ kind: 'project', projectId });
    },
    [openEntry]
  );

  const backEntityDrawer = useCallback(() => {
    const currentIndex = activeIndexRef.current;
    if (currentIndex < 0) return;

    if (currentIndex > 0) {
      commitStack(stackRef.current, currentIndex - 1);
      return;
    }

    const closing = stackRef.current[0];
    const closingEntityId = closing?.kind === 'entity' ? closing.entityId : undefined;
    commitStack(stackRef.current, -1);
    if (closingEntityId && linkedEntityIdRef.current === closingEntityId) {
      linkedEntityIdRef.current = undefined;
      void navigate({
        search: (previous: Record<string, unknown>) => ({ ...previous, drawer: undefined }),
        replace: true
      } as Parameters<typeof navigate>[0]);
    }
  }, [commitStack, navigate]);

  return (
    <EntityDrawerStackContext.Provider
      value={{
        drawerEntityId: activeEntityId(drawerStack[activeDrawerIndex]),
        drawerStack,
        activeDrawerIndex,
        openEntityDrawer,
        openCaseDrawer,
        openProjectDrawer,
        backEntityDrawer,
        closeEntityDrawer: backEntityDrawer
      }}
    >
      {children}
    </EntityDrawerStackContext.Provider>
  );
};

/**
 * App-wide entry point for opening any entity's drawer. When used outside the workspace stack
 * provider (for example in an isolated component test), it retains the original single-drawer
 * navigation behavior.
 */
export const useEntityDrawer = (): EntityDrawerController => {
  const context = useContext(EntityDrawerStackContext);
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as EntityDrawerSearchParams;

  const openEntityDrawer = useCallback(
    (entityId: string) =>
      navigate({
        search: (previous: Record<string, unknown>) => ({ ...previous, drawer: entityId })
      } as Parameters<typeof navigate>[0]),
    [navigate]
  );

  const closeEntityDrawer = useCallback(
    () =>
      navigate({
        search: (previous: Record<string, unknown>) => ({ ...previous, drawer: undefined })
      } as Parameters<typeof navigate>[0]),
    [navigate]
  );

  const fallback: EntityDrawerController = {
    drawerEntityId: search.drawer,
    drawerStack: search.drawer ? [{ kind: 'entity', entityId: search.drawer }] : [],
    activeDrawerIndex: search.drawer ? 0 : -1,
    openEntityDrawer,
    // Outside the workspace stack there is nowhere to host a case drawer; no-op.
    openCaseDrawer: () => {},
    openProjectDrawer: () => {},
    backEntityDrawer: closeEntityDrawer,
    closeEntityDrawer
  };

  return context ?? fallback;
};
