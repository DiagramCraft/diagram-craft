import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import styles from './WidgetRowList.module.css';

const FETCH_LIMIT = 500;

export type TopEntitiesWidgetConfig = {
  schema: string;
  owner?: string;
  lifecycle?: string;
  fieldId: string;
  direction: 'asc' | 'desc';
  limit: number;
  label?: string;
};

type Props = {
  config: TopEntitiesWidgetConfig;
};

export const TopEntitiesWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const hasConfig = !!config.schema && !!config.fieldId;

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    {
      schemaId: config.schema,
      owner: config.owner || undefined,
      lifecycle: config.lifecycle || undefined,
      limit: FETCH_LIMIT
    },
    { enabled: !!workspaceSlug && hasConfig }
  );

  const direction = config.direction ?? 'desc';
  const limit = config.limit ?? 5;

  const ranked = useMemo(() => {
    const withValue = entities
      .map(entity => ({ entity, value: entity[config.fieldId] }))
      .filter(
        (item): item is { entity: (typeof entities)[number]; value: number } =>
          typeof item.value === 'number'
      );
    withValue.sort((a, b) => (direction === 'desc' ? b.value - a.value : a.value - b.value));
    return withValue.slice(0, limit);
  }, [entities, config.fieldId, direction, limit]);

  if (!hasConfig) {
    return <div className={`${styles.emptyInline} dim`}>This widget is not fully configured.</div>;
  }

  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading…</div>;
  }

  if (ranked.length === 0) {
    return <div className={`${styles.emptyInline} dim`}>No entities.</div>;
  }

  const goToCatalog = () =>
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: {
        filters: JSON.stringify([
          { fieldId: '_schemaId', op: 'equals' as const, value: config.schema }
        ])
      }
    });

  return (
    <div className={styles.list}>
      {ranked.map(({ entity, value }) => (
        <button
          key={entity._uid}
          type="button"
          className={styles.row}
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          <span className={styles.rowLabel}>{entity._name}</span>
          <span className={styles.rowMeta}>{value}</span>
        </button>
      ))}
      <button type="button" className={styles.footer} onClick={goToCatalog}>
        View in catalog
      </button>
    </div>
  );
};
