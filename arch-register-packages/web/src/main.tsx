import './tokens.css';
import { applyTheme, migrateTheme } from './hooks/useTheme';

// Apply saved theme immediately to avoid flash of wrong theme
(() => {
  try {
    applyTheme(migrateTheme());
  } catch {
    /* ignore */
  }
})();

import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { PermissionProvider } from './auth/PermissionContext';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import { PortalContextProvider } from '@diagram-craft/app-components/PortalContext';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';

const InnerApp = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Update router context when auth state changes
  useEffect(() => {
    router.update({
      context: {
        ...router.options.context,
        auth: { isAuthenticated, isLoading }
      }
    });
    router.invalidate();
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
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
    );
  }

  return <RouterProvider router={router} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <GlobalErrorBoundary>
      <AuthProvider>
        <PermissionProvider>
          <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
            <PortalContextProvider>
              <InnerApp />
            </PortalContextProvider>
          </DialogContextProvider>
        </PermissionProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  </QueryClientProvider>
);
