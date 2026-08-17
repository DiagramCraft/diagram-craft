import { useMemo, useState } from 'react';
import { useNavigate, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { glossaryConfigQuery, glossaryTermsQuery } from '../../queries/glossary';
import { entitiesQuery } from '../../queries/entities';
import styles from './GlossaryScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/glossary');

export const GlossaryScreen = () => {
  const { workspaceSlug } = routeApi.useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [quality, setQuality] = useState<
    'unused' | 'conflicting' | 'deprecated' | 'ownerless' | undefined
  >();
  const [categoryId, setCategoryId] = useState<string>();
  const config = useQuery(glossaryConfigQuery(workspaceSlug));
  const categories = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: config.data?.categorySchemaId, view: 'summary', limit: 100 },
      config.data != null
    )
  );
  const terms = useQuery(
    glossaryTermsQuery(workspaceSlug, {
      q: q.trim() || undefined,
      quality,
      categoryIds: categoryId ? [categoryId] : undefined,
      limit: 100
    })
  );
  const items = terms.data?.items ?? [];
  const reportButtons = useMemo(
    () =>
      [
        ['unused', 'Unused'],
        ['conflicting', 'Conflicting'],
        ['deprecated', 'Deprecated'],
        ['ownerless', 'Ownerless']
      ] as const,
    []
  );

  if (config.isLoading) return <div className={styles.empty}>Loading glossary…</div>;
  if (!config.data) {
    return <div className={styles.empty}>The business glossary is not enabled.</div>;
  }

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Business glossary</div>
          <div className={styles.subtitle}>
            Find governed terms by canonical name, synonym, or abbreviation.
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/entities',
              params: { workspaceSlug },
              search: { type: config.data!.termSchemaId }
            })
          }
        >
          Open in Entities
        </Button>
        <Button
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/entities',
              params: { workspaceSlug },
              search: { type: config.data!.categorySchemaId }
            })
          }
        >
          Manage categories
        </Button>
      </div>

      <div className={styles.controls}>
        <input
          className={styles.search}
          value={q}
          placeholder="Search terms, synonyms, abbreviations…"
          aria-label="Search glossary"
          onChange={event => setQ(event.target.value)}
        />
        <Button
          variant={quality === undefined ? 'primary' : undefined}
          onClick={() => setQuality(undefined)}
        >
          All terms
        </Button>
        {reportButtons.map(([value, label]) => (
          <Button
            key={value}
            variant={quality === value ? 'primary' : undefined}
            onClick={() => setQuality(current => (current === value ? undefined : value))}
          >
            {label}
          </Button>
        ))}
        <Button
          variant={categoryId === undefined ? 'primary' : undefined}
          onClick={() => setCategoryId(undefined)}
        >
          All categories
        </Button>
        {(categories.data?.items ?? []).map(category => (
          <Button
            key={category._uid}
            variant={categoryId === category._uid ? 'primary' : undefined}
            onClick={() =>
              setCategoryId(current => (current === category._uid ? undefined : category._uid))
            }
          >
            {category._name}
          </Button>
        ))}
      </div>

      {terms.isLoading ? (
        <div className={styles.empty}>Loading terms…</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>No glossary terms match these filters.</div>
      ) : (
        <div className={styles.list}>
          {items.map(term => (
            <button
              type="button"
              className={styles.term}
              key={term.entity._uid}
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/glossary/$termId',
                  params: { workspaceSlug, termId: term.entity._publicId }
                })
              }
            >
              <div>
                <div className={styles.termName}>{term.canonicalName}</div>
                {term.aliases.length > 0 && (
                  <div className={styles.aliases}>{term.aliases.join(' · ')}</div>
                )}
                <div className={styles.meta}>
                  {term.categories.map(category => category.name).join(' · ') || 'Uncategorized'}
                  {' · '}
                  {term.usageCount} usage{term.usageCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className={styles.badges}>
                {term.status && <span className={styles.badge}>{term.status}</span>}
                {term.quality.conflicting && (
                  <span className={`${styles.badge} ${styles.quality}`}>Conflict</span>
                )}
                {term.quality.deprecated && (
                  <span className={`${styles.badge} ${styles.quality}`}>Deprecated</span>
                )}
                {term.quality.ownerless && (
                  <span className={`${styles.badge} ${styles.quality}`}>Ownerless</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
};
