import { useAuth } from './auth/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import App from './App';

export const AuthenticatedApp = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-1)',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-1)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <App />;
};
