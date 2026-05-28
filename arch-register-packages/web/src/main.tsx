import './tokens.css';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { AuthenticatedApp } from './AuthenticatedApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <AuthenticatedApp />
  </AuthProvider>
);
