import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { EntityDrawerSearchParams } from '../../../routes/searchParams';

export type EntityDrawerStackEntry = {
  entityId: string;
};

export type EntityDrawerController = {
  drawerEntityId: string | undefined;
  drawerStack: readonly EntityDrawerStackEntry[];
  activeDrawerIndex: number;
  openEntityDrawer: (entityId: string) => void;
  backEntityDrawer: () => void;
  closeEntityDrawer: () => void;
};

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
  const initialStack = search.drawer ? [{ entityId: search.drawer }] : [];
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

  const openEntityDrawer = useCallback(
    (entityId: string) => {
      if (!entityId) return;

      const currentIndex = activeIndexRef.current;
      const visibleStack = stackRef.current.slice(0, currentIndex + 1);
      const existingIndex = visibleStack.findIndex(entry => entry.entityId === entityId);
      const nextStack =
        existingIndex >= 0
          ? visibleStack
          : [...visibleStack, { entityId } satisfies EntityDrawerStackEntry];
      const nextIndex = existingIndex >= 0 ? existingIndex : nextStack.length - 1;

      commitStack(nextStack, nextIndex);
    },
    [commitStack]
  );

  const backEntityDrawer = useCallback(() => {
    const currentIndex = activeIndexRef.current;
    if (currentIndex < 0) return;

    if (currentIndex > 0) {
      commitStack(stackRef.current, currentIndex - 1);
      return;
    }

    const closingEntityId = stackRef.current[0]?.entityId;
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
        drawerEntityId: drawerStack[activeDrawerIndex]?.entityId,
        drawerStack,
        activeDrawerIndex,
        openEntityDrawer,
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
    drawerStack: search.drawer ? [{ entityId: search.drawer }] : [],
    activeDrawerIndex: search.drawer ? 0 : -1,
    openEntityDrawer,
    backEntityDrawer: closeEntityDrawer,
    closeEntityDrawer
  };

  return context ?? fallback;
};
