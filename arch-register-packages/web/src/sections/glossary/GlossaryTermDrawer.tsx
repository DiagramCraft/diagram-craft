import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
import { Chip } from '../../components/Chip';
import { Drawer } from '../../components/Drawer';
import { StatusChip } from '../../components/StatusChip';
import { useLifecycleStates } from '../../hooks/useWorkspaceConfig';
import { glossaryConfigQuery, glossaryTermQuery, glossaryUsageQuery } from '../../queries/glossary';
import { entitiesQuery } from '../../queries/entities';
import { schemaColor } from '../../lib/schemaPresentation';
import { asEntityPublicId, entityDetailRoute } from '../../routes/publicObjectRoutes';
import { GlossaryQualityBadges } from './GlossaryQualityBadges';
import styles from './GlossaryScreen.module.css';

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

export const GlossaryTermDrawer = ({
  workspaceSlug,
  termId,
  onClose
}: {
  workspaceSlug: string;
  termId: string;
  onClose: () => void;
}) => {
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

  const usageGroups = Object.keys(USAGE_KIND_LABEL)
    .map(kind => ({ kind, items: (usage.data ?? []).filter(item => item.kind === kind) }))
    .filter(group => group.items.length > 0);

  if (term.isLoading || config.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading term…</div>
      </Drawer>
    );
  }
  if (term.isError || !term.data || !config.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This glossary term is unavailable.</div>
      </Drawer>
    );
  }

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{term.data.entity._publicId}</span>}
      title={term.data.canonicalName}
      badges={
        <>
          {term.data.status && <Chip tone="ghost">{term.data.status}</Chip>}
          {term.data.entity._lifecycle && (
            <StatusChip value={term.data.entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
          <GlossaryQualityBadges quality={term.data.quality} />
        </>
      }
      footer={
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
    >
      <div className={styles.sectionLabel}>Definition</div>
      <p>
        {(() => {
          const definition = term.data.entity[config.data.fields.definition];
          return typeof definition === 'string' && definition.trim()
            ? definition
            : 'No definition yet.';
        })()}
      </p>

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

      {term.data.quality.conflicting && (
        <div className={styles.conflictNote}>
          <TbAlertTriangle size={14} />
          <span>This term's name or an alias overlaps with another term.</span>
        </div>
      )}

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

      <div className={styles.sectionLabel}>Owner</div>
      {term.data.entity._owner?.name ?? <span className="dim">No owner assigned</span>}

      <div className={styles.sectionLabel}>
        Usage &amp; backlinks
        <span className="dim" style={{ marginLeft: 8, fontWeight: 400 }}>
          {(usage.data ?? []).length} visible reference
          {(usage.data ?? []).length === 1 ? '' : 's'}
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
    </Drawer>
  );
};
