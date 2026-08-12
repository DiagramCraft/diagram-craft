import { Link, Outlet, useParams } from '@tanstack/react-router';
import { usePublicCatalogManifest } from '../hooks/usePublicCatalog';
import { useTheme } from '../hooks/useTheme';
import { publicCatalogOpenAPISpecUrl } from '../lib/orpcClient';
import { ThemeToggle } from '../components/ThemeToggle';
import styles from './publicCatalog.module.css';

export const PublicCatalogLayout = () => {
  const { workspaceSlug = '' } = useParams({ strict: false }) as { workspaceSlug?: string };
  const manifest = usePublicCatalogManifest(workspaceSlug);
  const { theme, setTheme } = useTheme({ fallback: 'system' });

  if (manifest.isLoading) {
    return (
      <div className={styles.stateShell}>
        <div className={styles.state}>Loading public catalog…</div>
      </div>
    );
  }
  if (manifest.isError || !manifest.data) {
    return (
      <div className={styles.stateShell}>
        <div className={styles.state}>This public catalog is not available.</div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {!manifest.data.indexable && <meta name="robots" content="noindex,nofollow" />}
      <header className={styles.header}>
        <Link className={styles.brand} to="/public/$workspaceSlug" params={{ workspaceSlug }}>
          {manifest.data.title}
        </Link>
        <nav className={styles.nav} aria-label="Public catalog">
          <Link to="/public/$workspaceSlug/entities" params={{ workspaceSlug }}>
            Entities
          </Link>
          <Link to="/public/$workspaceSlug/topology" params={{ workspaceSlug }}>
            Topology
          </Link>
          {manifest.data.pages.slice(0, 5).map(page => (
            <Link
              key={page.path}
              to="/public/$workspaceSlug/wiki"
              params={{ workspaceSlug }}
              search={{ path: page.path }}
            >
              {page.label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.apiLink} href={publicCatalogOpenAPISpecUrl()}>
            API
          </a>
          <ThemeToggle theme={theme} onSetTheme={setTheme} />
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>Read-only public catalog</footer>
    </div>
  );
};
