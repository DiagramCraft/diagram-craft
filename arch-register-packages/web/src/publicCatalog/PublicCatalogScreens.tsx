import { useState } from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import type {
  PublicCatalogApiSpecificationPage,
  PublicCatalogEntity
} from '@arch-register/api-types/publicCatalogContract';
import { SafeMarkdown } from '../components/SafeMarkdown';
import {
  usePublicCatalogEntities,
  usePublicCatalogEntity,
  usePublicCatalogManifest,
  usePublicCatalogWikiPage
} from '../hooks/usePublicCatalog';
import { publicCatalogRequest } from '../lib/orpcClient';
import styles from './publicCatalog.module.css';
import { useQuery } from '@tanstack/react-query';

const routeParams = () =>
  useParams({ strict: false }) as {
    workspaceSlug?: string;
    entityPublicId?: string;
    artifactId?: string;
    revisionId?: string;
  };

const ErrorState = ({ message }: { message: string }) => (
  <div className={styles.state}>{message}</div>
);

export const PublicCatalogHome = () => {
  const { workspaceSlug = '' } = routeParams();
  const { data: manifest } = usePublicCatalogManifest(workspaceSlug);
  const { data: entities } = usePublicCatalogEntities(workspaceSlug);
  if (!manifest) return <ErrorState message="This public catalog is not available." />;
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>PUBLIC CATALOG</p>
      <h1>{manifest.title}</h1>
      {manifest.description && <p className={styles.lede}>{manifest.description}</p>}
      <div className={styles.stats}>
        <div>
          <strong>{manifest.entityCount}</strong>
          <span>published entities</span>
        </div>
        <div>
          <strong>{manifest.schemas.length}</strong>
          <span>entity schemas</span>
        </div>
        <div>
          <strong>{manifest.pages.length}</strong>
          <span>wiki pages</span>
        </div>
      </div>
      {manifest.pages.length > 0 && (
        <div className={styles.cardGrid}>
          {manifest.pages.map(page => (
            <a
              className={styles.card}
              key={page.path}
              href={`/public/${encodeURIComponent(workspaceSlug)}/wiki?path=${encodeURIComponent(page.path)}`}
            >
              <span className={styles.cardKicker}>{page.scope}</span>
              <strong>{page.label}</strong>
              <span>/{page.path}</span>
            </a>
          ))}
        </div>
      )}
      <div className={styles.sectionHeading}>
        <h2>Published entities</h2>
        <a href={`/public/${encodeURIComponent(workspaceSlug)}/entities`}>Browse all</a>
      </div>
      <div className={styles.entityList}>
        {(entities?.items ?? []).slice(0, 8).map(entity => (
          <EntityCard key={entity.publicId} entity={entity} workspaceSlug={workspaceSlug} />
        ))}
      </div>
    </section>
  );
};

const EntityCard = ({
  entity,
  workspaceSlug
}: {
  entity: PublicCatalogEntity;
  workspaceSlug: string;
}) => (
  <a
    className={styles.entityCard}
    href={`/public/${encodeURIComponent(workspaceSlug)}/entities/${encodeURIComponent(entity.publicId)}`}
  >
    <span className={styles.cardKicker}>{entity.schema.name}</span>
    <strong>{entity.name}</strong>
    <span>{entity.publicId}</span>
    {entity.description && <p>{entity.description}</p>}
  </a>
);

export const PublicCatalogEntities = () => {
  const { workspaceSlug = '' } = routeParams();
  const [q, setQ] = useState('');
  const { data, isLoading, isError } = usePublicCatalogEntities(workspaceSlug, {
    q: q || undefined
  });
  if (isLoading) return <ErrorState message="Loading entities…" />;
  if (isError || !data) return <ErrorState message="Unable to load published entities." />;
  return (
    <section>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>CATALOG</p>
          <h1>Entities</h1>
        </div>
        <span>{data.total} published</span>
      </div>
      <input
        className={styles.search}
        value={q}
        onChange={event => setQ(event.target.value)}
        placeholder="Search published entities"
      />
      <div className={styles.entityList}>
        {data.items.map(entity => (
          <EntityCard key={entity.publicId} entity={entity} workspaceSlug={workspaceSlug} />
        ))}
      </div>
      {data.items.length === 0 && (
        <p className={styles.muted}>No published entities match this search.</p>
      )}
    </section>
  );
};

export const PublicCatalogEntityPage = () => {
  const { workspaceSlug = '', entityPublicId = '' } = routeParams();
  const { data, isLoading, isError } = usePublicCatalogEntity(workspaceSlug, entityPublicId);
  if (isLoading) return <ErrorState message="Loading entity…" />;
  if (isError || !data) return <ErrorState message="This published entity is not available." />;
  const fieldDefinitions = new Map(data.schema.fields.map(field => [field.id, field]));
  return (
    <section>
      <a className={styles.back} href={`/public/${encodeURIComponent(workspaceSlug)}/entities`}>
        ← All entities
      </a>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>{data.schema.name}</p>
          <h1>{data.name}</h1>
          <p className={styles.muted}>{data.publicId}</p>
        </div>
      </div>
      {data.description && <p className={styles.lede}>{data.description}</p>}
      <div className={styles.detailGrid}>
        <div>
          <span>Lifecycle</span>
          <strong>{data.lifecycle ?? '—'}</strong>
        </div>
        <div>
          <span>Owner</span>
          <strong>{data.owner ?? '—'}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{new Date(data.updatedAt).toLocaleDateString()}</strong>
        </div>
      </div>
      <div className={styles.fieldTable}>
        {Object.entries(data.fields).map(([fieldId, value]) => (
          <div key={fieldId}>
            <span>{fieldDefinitions.get(fieldId)?.name ?? fieldId}</span>
            <strong>{formatValue(value)}</strong>
          </div>
        ))}
      </div>
      {data.apiArtifacts.length > 0 && (
        <div className={styles.sectionBlock}>
          <h2>API specifications</h2>
          {data.apiArtifacts.map(api => (
            <a
              className={styles.card}
              key={api.artifactId}
              href={
                api.currentRevisionId
                  ? `/public/${encodeURIComponent(workspaceSlug)}/api/${encodeURIComponent(data.publicId)}/${encodeURIComponent(api.artifactId)}/${encodeURIComponent(api.currentRevisionId)}`
                  : '#'
              }
            >
              <strong>{api.title ?? 'API specification'}</strong>
              <span>
                {api.protocol ?? 'Unknown protocol'} ·{' '}
                {api.rawAvailable ? 'raw source available' : 'normalized browse only'}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};

const formatValue = (value: unknown) => {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const PublicCatalogWikiPage = () => {
  const { workspaceSlug = '' } = routeParams();
  const search = useSearch({ strict: false }) as { path?: string };
  const path = search.path ?? '';
  const { data, isLoading, isError } = usePublicCatalogWikiPage(workspaceSlug, path);
  if (!path) return <ErrorState message="Choose a published wiki page." />;
  if (isLoading) return <ErrorState message="Loading wiki page…" />;
  if (isError || !data) return <ErrorState message="This published wiki page is not available." />;
  return (
    <article className={styles.article}>
      <a className={styles.back} href={`/public/${encodeURIComponent(workspaceSlug)}`}>
        ← Catalog home
      </a>
      <p className={styles.eyebrow}>{data.scope} wiki</p>
      <h1>{data.label}</h1>
      <SafeMarkdown
        text={data.body}
        classNames={{ root: styles.markdown, link: styles.markdownLink }}
        onEntityLink={entityId => {
          window.location.href = `/public/${encodeURIComponent(workspaceSlug)}/entities/${encodeURIComponent(entityId)}`;
        }}
      />
    </article>
  );
};

export const PublicCatalogApiPage = () => {
  const {
    workspaceSlug = '',
    entityPublicId = '',
    artifactId = '',
    revisionId = ''
  } = routeParams();
  const query = useQuery({
    queryKey: ['public-catalog-api', workspaceSlug, entityPublicId, artifactId, revisionId],
    queryFn: () =>
      publicCatalogRequest<PublicCatalogApiSpecificationPage>(
        `/${encodeURIComponent(workspaceSlug)}/entities/${encodeURIComponent(entityPublicId)}/api-specifications/${encodeURIComponent(artifactId)}/revisions/${encodeURIComponent(revisionId)}?limit=200&offset=0`
      ),
    enabled: Boolean(workspaceSlug && entityPublicId && artifactId && revisionId),
    staleTime: 60_000
  });
  if (query.isLoading) return <ErrorState message="Loading API specification…" />;
  if (query.isError || !query.data)
    return <ErrorState message="This API specification is not available." />;
  const { revision, items } = query.data;
  return (
    <section>
      <a
        className={styles.back}
        href={`/public/${encodeURIComponent(workspaceSlug)}/entities/${encodeURIComponent(entityPublicId)}`}
      >
        ← Entity
      </a>
      <p className={styles.eyebrow}>{revision.protocol ?? 'API'} specification</p>
      <h1>{revision.title ?? 'API specification'}</h1>
      {revision.description && <p className={styles.lede}>{revision.description}</p>}
      <p className={styles.muted}>
        {revision.itemCount} normalized items · revision {revision.revision.id}
      </p>
      <div className={styles.apiList}>
        {items.map(item => (
          <div className={styles.apiItem} key={item.id}>
            <div>
              <span className={styles.method}>{item.action.toUpperCase()}</span>{' '}
              <strong>{item.path ?? item.channel ?? item.identifier}</strong>
            </div>
            {item.summary && <p>{item.summary}</p>}
            {item.description && <p className={styles.muted}>{item.description}</p>}
            {item.tags.length > 0 && <span className={styles.muted}>{item.tags.join(' · ')}</span>}
          </div>
        ))}
      </div>
    </section>
  );
};
