import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router';
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

const navigateSearch = (
  entityId: string | undefined,
  replace = false
): Record<string, unknown> => ({
  search: (previous: Record<string, unknown>) => ({ ...previous, drawer: entityId }),
  ...(replace ? { replace: true } : {})
});

/**
 * Provides the workspace-local entity drawer stack. The URL deliberately stores only the active
 * entity so links stay short; the stack is reconstructed from in-app navigation and browser
 * history. A direct `drawer=<id>` link therefore opens that entity as the root drawer.
 */
export const EntityDrawerStackProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const router = useRouter();
  const search = useSearch({ strict: false }) as EntityDrawerSearchParams;
  const initialStack = search.drawer ? [{ entityId: search.drawer }] : [];
  const [drawerStack, setDrawerStack] = useState<readonly EntityDrawerStackEntry[]>(initialStack);
  const [activeDrawerIndex, setActiveDrawerIndex] = useState(search.drawer ? 0 : -1);
  const stackRef = useRef<readonly EntityDrawerStackEntry[]>(initialStack);
  const activeIndexRef = useRef(search.drawer ? 0 : -1);

  const commitStack = useCallback(
    (nextStack: readonly EntityDrawerStackEntry[], nextIndex: number) => {
      stackRef.current = nextStack;
      activeIndexRef.current = nextIndex;
      setDrawerStack(nextStack);
      setActiveDrawerIndex(nextIndex);
    },
    []
  );

  useEffect(() => {
    const entityId = search.drawer;
    if (!entityId) {
      commitStack(stackRef.current, -1);
      return;
    }

    const existingIndex = stackRef.current.findIndex(entry => entry.entityId === entityId);
    if (existingIndex >= 0) {
      commitStack(stackRef.current, existingIndex);
    } else {
      commitStack([{ entityId }], 0);
    }
  }, [commitStack, search.drawer]);

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
      if (nextIndex === currentIndex && search.drawer === entityId) return;

      if (existingIndex >= 0 && nextIndex < currentIndex) {
        router.history.go(nextIndex - currentIndex);
        return;
      }

      void navigate(navigateSearch(entityId) as Parameters<typeof navigate>[0]);
    },
    [commitStack, navigate, router.history, search.drawer]
  );

  const backEntityDrawer = useCallback(() => {
    const currentIndex = activeIndexRef.current;
    if (currentIndex < 0) return;

    if (currentIndex > 0) {
      commitStack(stackRef.current, currentIndex - 1);
      router.history.back();
      return;
    }

    commitStack(stackRef.current, -1);
    void navigate(navigateSearch(undefined, true) as Parameters<typeof navigate>[0]);
  }, [commitStack, navigate, router.history]);

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
