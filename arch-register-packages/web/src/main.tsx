import './tokens.css';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './auth/AuthContext';
import { PermissionProvider } from './auth/PermissionContext';
import { AuthenticatedApp } from './AuthenticatedApp';
import { queryClient } from './lib/queryClient';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PermissionProvider>
        <AuthenticatedApp />
      </PermissionProvider>
    </AuthProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
