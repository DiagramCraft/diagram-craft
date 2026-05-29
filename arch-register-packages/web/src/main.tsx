import './tokens.css';
import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { PermissionProvider } from './auth/PermissionContext';
import { queryClient } from './lib/queryClient';
import { router } from './router';

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
          background: 'var(--bg-1)'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-1)',
            borderTopColor: 'var(--accent)',
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
    <AuthProvider>
      <PermissionProvider>
        <InnerApp />
      </PermissionProvider>
    </AuthProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
