import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/Banner';
import { LoadingState } from '../components/LoadingState';
import { useAuthConfig } from '../hooks/useAuthConfig';
import styles from './LoginScreen.module.css';

export const LoginScreen = () => {
  const { login, loginWithOidc, isLoading } = useAuth();
  const { data: authConfig, isLoading: isLoadingConfig } = useAuthConfig();
  const navigate = useNavigate();
  const search = useSearch({ from: '/login' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const authMode = authConfig?.mode ?? 'local';
  const sessionMessage =
    search.reason === 'session-expired'
      ? 'Your session expired while Arch Register was open. Sign in again to continue where you left off.'
      : '';

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const u = username.trim();
    const p = password;
    if (!u || !p) {
      setError('Enter your username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username, password);
      // Redirect to the original destination or home
      if (search.redirect) {
        window.location.href = search.redirect;
      } else {
        navigate({ to: '/' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOidcLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await loginWithOidc();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate login');
      setIsSubmitting(false);
    }
  };

  const clearError = () => {
    if (error) setError('');
  };

  if (isLoading || isLoadingConfig) {
    return (
      <div className={styles.app}>
        <main className={styles.stage}>
          <div className={styles.card}>
            <div className={styles.head}>
              <span className={styles.badge} aria-hidden="true">AR</span>
              <div>
                <div className={styles.brandName}>Arch Register</div>
              </div>
            </div>
            <div className={styles.loadingWrap}>
              <LoadingState text="Loading..." size="sm" />
            </div>
          </div>
        </main>
        <div className={styles.statusbar} />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <main className={styles.stage}>
        <form className={styles.card} onSubmit={handleLocalLogin} autoComplete="on" noValidate>
          <header className={styles.head}>
            <span className={styles.badge} aria-hidden="true">AR</span>
            <div>
              <div className={styles.brandName}>Arch Register</div>
            </div>
          </header>

          <div className={styles.titleRow}>
            <h1 className={styles.title}>Sign in</h1>
            <div className={styles.sub}>Use your workspace credentials to continue.</div>
          </div>

          {authMode === 'local' ? (
            <div className={styles.form}>
              {sessionMessage && !error && <Banner variant="error">{sessionMessage}</Banner>}
              {error && <Banner variant="error">{error}</Banner>}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="lg-user">Username</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="8" cy="5.5" r="2.5" />
                      <path d="M3 14c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
                    </svg>
                  </span>
                  <input
                    id="lg-user"
                    name="username"
                    type="text"
                    className={styles.input}
                    placeholder="jane.doe"
                    autoComplete="username"
                    spellCheck={false}
                    autoCapitalize="off"
                    required
                    disabled={isSubmitting}
                    autoFocus
                    value={username}
                    onChange={e => { setUsername(e.target.value); clearError(); }}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="lg-pass">
                  <span>Password</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="7" width="10" height="7" rx="1" />
                      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                    </svg>
                  </span>
                  <input
                    id="lg-pass"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className={styles.inputMono}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError(); }}
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
                      <circle cx="8" cy="8" r="1.75" />
                    </svg>
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.submit} disabled={isSubmitting}>
                <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
                {!isSubmitting && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 8h9" />
                    <path d="M8.5 4.5L12 8l-3.5 3.5" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div className={styles.oidcContainer}>
              {sessionMessage && !error && <Banner variant="error">{sessionMessage}</Banner>}
              {error && <Banner variant="error">{error}</Banner>}
              <button
                type="button"
                onClick={handleOidcLogin}
                className={styles.submit}
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Redirecting...' : 'Sign in with SSO'}</span>
                {!isSubmitting && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 8h9" />
                    <path d="M8.5 4.5L12 8l-3.5 3.5" />
                  </svg>
                )}
              </button>
            </div>
          )}

        </form>
      </main>

      <div className={styles.statusbar}>
        <div className={styles.statusbarL}>
          <span className={styles.statusbarItem}>
            <span className={styles.statusbarDotOk} />
            auth
          </span>
        </div>
        <div className={styles.statusbarR}>
          {authMode === 'oidc' && (
            <span className={styles.statusbarItem}>SSO available</span>
          )}
        </div>
      </div>
    </div>
  );
};
