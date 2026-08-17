import { useNavigate, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { glossaryConfigQuery, glossaryTermQuery, glossaryUsageQuery } from '../../queries/glossary';
import styles from './GlossaryScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/glossary/$termId');

export const GlossaryTermScreen = () => {
  const { workspaceSlug, termId } = routeApi.useParams();
  const navigate = useNavigate();
  const config = useQuery(glossaryConfigQuery(workspaceSlug));
  const term = useQuery(glossaryTermQuery(workspaceSlug, termId));
  const usage = useQuery(glossaryUsageQuery(workspaceSlug, termId));

  if (term.isLoading || config.isLoading) return <div className={styles.empty}>Loading term…</div>;
  if (term.isError || !term.data || !config.data) {
    return <div className={styles.empty}>This glossary term is unavailable.</div>;
  }

  const definition = term.data.entity[config.data.fields.definition];
  return (
    <main className={styles.screen}>
      <Button
        onClick={() => navigate({ to: '/$workspaceSlug/glossary', params: { workspaceSlug } })}
      >
        Back to glossary
      </Button>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{term.data.canonicalName}</div>
          <div className={styles.subtitle}>{term.data.entity._publicId}</div>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/entities/$entityId',
              params: { workspaceSlug, entityId: term.data!.entity._publicId }
            })
          }
        >
          Open entity
        </Button>
      </div>
      <section>
        <h2>Definition</h2>
        <p>
          {typeof definition === 'string' && definition.trim() ? definition : 'No definition yet.'}
        </p>
      </section>
      <section>
        <h2>Aliases</h2>
        <p>{term.data.aliases.length > 0 ? term.data.aliases.join(' · ') : 'No aliases.'}</p>
      </section>
      <section>
        <h2>Categories</h2>
        <p>{term.data.categories.map(category => category.name).join(' · ') || 'Uncategorized'}</p>
      </section>
      <section>
        <h2>Usage and backlinks</h2>
        {(usage.data ?? []).length === 0 ? (
          <p>No visible explicit usage found.</p>
        ) : (
          <ul>
            {usage.data!.map(item => (
              <li key={`${item.kind}:${item.id}:${item.context ?? ''}`}>
                {item.label}{' '}
                <span className="dim">
                  ({item.kind}
                  {item.context ? ` · ${item.context}` : ''})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};
