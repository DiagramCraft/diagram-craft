import { useMemo } from 'react';
import { useNavigate, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TbAlertTriangle,
  TbArrowsRightLeft,
  TbDatabase,
  TbFileText,
  TbFolders,
  TbSitemap
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../components/Title';
import { Chip } from '../../components/Chip';
import { StatusChip } from '../../components/StatusChip';
import { useLifecycleStates } from '../../hooks/useWorkspaceConfig';
import { glossaryConfigQuery, glossaryTermQuery, glossaryUsageQuery } from '../../queries/glossary';
import { entitiesQuery } from '../../queries/entities';
import { schemaColor } from '../../lib/schemaPresentation';
import { asEntityPublicId, entityDetailRoute } from '../../routes/publicObjectRoutes';
import { GlossaryQualityBadges } from './GlossaryQualityBadges';
import styles from './GlossaryScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/glossary/$termId');

const USAGE_KIND_LABEL: Record<string, string> = {
  entity: 'Referencing entities',
  relation: 'Typed relations',
  document: 'Linked documents',
  project: 'Projects',
  diagram: 'Diagrams'
};

const USAGE_KIND_ICON: Record<string, typeof TbDatabase> = {
  entity: TbDatabase,
  relation: TbArrowsRightLeft,
  document: TbFileText,
  project: TbFolders,
  diagram: TbSitemap
};

export const GlossaryTermScreen = () => {
  const { workspaceSlug, termId } = routeApi.useParams();
  const navigate = useNavigate();
  const config = useQuery(glossaryConfigQuery(workspaceSlug));
  const term = useQuery(glossaryTermQuery(workspaceSlug, termId));
  const usage = useQuery(glossaryUsageQuery(workspaceSlug, termId));
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const categories = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: config.data?.categorySchemaId, view: 'summary', limit: 100 },
      config.data != null
    )
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    (categories.data?.items ?? []).forEach((category, index) => {
      map.set(category._uid, { name: category._name, color: schemaColor(index) });
    });
    return map;
  }, [categories.data]);

  if (term.isLoading || config.isLoading) return <div className={styles.empty}>Loading term…</div>;
  if (term.isError || !term.data || !config.data) {
    return <div className={styles.empty}>This glossary term is unavailable.</div>;
  }

  const definition = term.data.entity[config.data.fields.definition];
  const usageGroups = Object.keys(USAGE_KIND_LABEL)
    .map(kind => ({ kind, items: (usage.data ?? []).filter(item => item.kind === kind) }))
    .filter(group => group.items.length > 0);

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={[
            {
              label: 'Business glossary',
              onClick: () =>
                navigate({ to: '/$workspaceSlug/glossary', params: { workspaceSlug } })
            }
          ]}
          title={term.data.canonicalName}
          chips={
            <span className={styles.detailHeader}>
              <span className="dim mono">{term.data.entity._publicId}</span>
              {term.data.status && <Chip tone="ghost">{term.data.status}</Chip>}
              {term.data.entity._lifecycle && (
                <StatusChip
                  value={term.data.entity._lifecycle.id}
                  lifecycleStates={lifecycleStates}
                />
              )}
              <GlossaryQualityBadges quality={term.data.quality} />
            </span>
          }
          buttons={
            <Button
              variant="primary"
              onClick={() =>
                navigate(
                  entityDetailRoute(workspaceSlug, asEntityPublicId(term.data!.entity._publicId))
                )
              }
            >
              Open in Entities
            </Button>
          }
        />
      </div>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>Definition</div>
        <p>{typeof definition === 'string' && definition.trim() ? definition : 'No definition yet.'}</p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>Aliases</div>
        {term.data.aliases.length > 0 ? (
          <div className={styles.tags}>
            {term.data.aliases.map(alias => (
              <Chip key={alias} tone="ghost">
                {alias}
              </Chip>
            ))}
          </div>
        ) : (
          <span className="dim">No aliases.</span>
        )}
      </section>

      {term.data.quality.conflicting && (
        <div className={styles.conflictNote}>
          <TbAlertTriangle size={14} />
          <span>This term's name or an alias overlaps with another term.</span>
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionLabel}>Categories</div>
        {term.data.categories.length > 0 ? (
          <div className={styles.tags}>
            {term.data.categories.map(category => {
              const resolved = categoryById.get(category.id);
              return (
                <Chip key={category.id} tone="ghost" dot={resolved?.color}>
                  {resolved?.name ?? category.name}
                </Chip>
              );
            })}
          </div>
        ) : (
          <span className="dim">Uncategorized</span>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>Owner</div>
        {term.data.entity._owner?.name ?? <span className="dim">No owner assigned</span>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>
          Usage &amp; backlinks
          <span className="dim" style={{ marginLeft: 8, fontWeight: 400 }}>
            {(usage.data ?? []).length} visible reference{(usage.data ?? []).length === 1 ? '' : 's'}
          </span>
        </div>
        {usageGroups.length === 0 ? (
          <span className="dim">No visible explicit usage found.</span>
        ) : (
          usageGroups.map(group => {
            const KindIcon = USAGE_KIND_ICON[group.kind] ?? TbDatabase;
            return (
              <div key={group.kind} className={styles.usageGroup}>
                <div className={styles.usageGroupLabel}>{USAGE_KIND_LABEL[group.kind]}</div>
                {group.items.map((item, index) => (
                  <div key={`${item.kind}:${item.id}:${index}`} className={styles.usageRow}>
                    <KindIcon size={13} />
                    <span>{item.label}</span>
                    {item.context && <span className={styles.usageContext}>{item.context}</span>}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </section>
    </main>
  );
};
