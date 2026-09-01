import './tokens.css';
import { applyTheme, migrateTheme } from './hooks/useTheme';

// Apply saved theme immediately to avoid flash of wrong theme
(() => {
  try {
    const isPublicCatalog =
      window.location.pathname === '/public' || window.location.pathname.startsWith('/public/');
    applyTheme(migrateTheme({ fallback: isPublicCatalog ? 'system' : 'dark' }));
  } catch {
    /* ignore */
  }
})();

import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { WorkspaceAuthorizationProvider } from './auth/WorkspaceAuthorizationContext';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import { PortalContextProvider } from '@diagram-craft/app-components/PortalContext';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { DevTools } from './dev/DevTools';

const InnerApp = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const previousAuthState = useRef<boolean | null>(null);

  // Re-run route guards when auth state changes. The context is also passed to
  // RouterProvider below so the initial route load sees the current auth state
  // before any beforeLoad hooks execute.
  useEffect(() => {
    if (isLoading) return;
    if (previousAuthState.current !== null && previousAuthState.current !== isAuthenticated) {
      void router.invalidate();
    }
    previousAuthState.current = isAuthenticated;
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--base-bg)'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--cmp-border)',
              borderTopColor: 'var(--accent-fg)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}
          />
        </div>
        <DevTools />
      </>
    );
  }

  return (
    <>
      <RouterProvider router={router} context={{ auth: { isAuthenticated, isLoading } }} />
      <DevTools />
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <GlobalErrorBoundary>
      <AuthProvider>
        <WorkspaceAuthorizationProvider>
          <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
            <PortalContextProvider>
              <InnerApp />
            </PortalContextProvider>
          </DialogContextProvider>
        </WorkspaceAuthorizationProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  </QueryClientProvider>
);
