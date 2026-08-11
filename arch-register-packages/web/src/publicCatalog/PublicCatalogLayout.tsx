import { Outlet, useParams } from '@tanstack/react-router';
import { usePublicCatalogManifest } from '../hooks/usePublicCatalog';
import styles from './publicCatalog.module.css';

export const PublicCatalogLayout = () => {
  const { workspaceSlug = '' } = useParams({ strict: false }) as { workspaceSlug?: string };
  const manifest = usePublicCatalogManifest(workspaceSlug);
  const base = `/public/${encodeURIComponent(workspaceSlug)}`;

  if (manifest.isLoading) return <div className={styles.state}>Loading public catalog…</div>;
  if (manifest.isError || !manifest.data) {
    return <div className={styles.state}>This public catalog is not available.</div>;
  }

  return (
    <div className={styles.shell}>
      {!manifest.data.indexable && <meta name="robots" content="noindex,nofollow" />}
      <header className={styles.header}>
        <a className={styles.brand} href={base}>
          {manifest.data.title}
        </a>
        <nav className={styles.nav} aria-label="Public catalog">
          <a href={`${base}/entities`}>Entities</a>
          {manifest.data.pages.slice(0, 5).map(page => (
            <a key={page.path} href={`${base}/wiki?path=${encodeURIComponent(page.path)}`}>
              {page.label}
            </a>
          ))}
        </nav>
        <a className={styles.apiLink} href="/openapi/public-v1.json">
          API
        </a>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>Read-only public catalog</footer>
    </div>
  );
};
