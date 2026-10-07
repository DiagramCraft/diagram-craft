import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { formatMeasured, measuredValue, type MeasuredValue } from './fieldAggregation';
import styles from './WidgetRowList.module.css';

const FETCH_LIMIT = 500;

export type TopEntitiesWidgetConfig = {
  /** Schema id. Either this or `schemaName` identifies the ranked entity type. */
  schema: string;
  /** Schema name, resolved against the live workspace schemas (used by seeded dashboards). */
  schemaName?: string;
  owner?: string;
  lifecycle?: string;
  fieldId: string;
  direction: 'asc' | 'desc';
  limit: number;
  /** Draw each row's share of the listed total as a bar under the name. */
  showShareBar?: boolean;
  /** Show the "View in catalog" footer link. Default true. */
  showLink?: boolean;
  label?: string;
};

type Props = {
  config: TopEntitiesWidgetConfig;
};

export const TopEntitiesWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schemaId =
    config.schema || schemas.find(candidate => candidate.name === config.schemaName)?.id || '';
  const hasConfig = !!schemaId && !!config.fieldId;

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    {
      schemaId,
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
      .map(entity => ({ entity, value: measuredValue(entity[config.fieldId]) }))
      .filter(
        (item): item is { entity: (typeof entities)[number]; value: MeasuredValue } =>
          item.value !== undefined
      );
    withValue.sort((a, b) =>
      direction === 'desc' ? b.value.amount - a.value.amount : a.value.amount - b.value.amount
    );
    return withValue.slice(0, limit);
  }, [entities, config.fieldId, direction, limit]);

  const shareTotal = ranked.reduce((sum, item) => sum + Math.max(item.value.amount, 0), 0);

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
        filters: JSON.stringify([{ fieldId: '_schemaId', op: 'equals' as const, value: schemaId }])
      }
    });

  return (
    <div className={styles.list}>
      {ranked.map(({ entity, value }) => (
        <button
          key={entity._uid}
          type="button"
          className={`${styles.row} ${config.showShareBar ? styles.rowShare : ''}`}
          onClick={() => openEntityDrawer(entity._publicId)}
        >
          <span className={styles.rowLabel}>{entity._name}</span>
          {config.showShareBar && (
            <span className={styles.shareTrack} aria-hidden>
              <span
                className={styles.shareFill}
                style={{
                  width: `${shareTotal > 0 ? Math.round((Math.max(value.amount, 0) / shareTotal) * 100) : 0}%`
                }}
              />
            </span>
          )}
          <span className={styles.rowMeta}>{formatMeasured(value.amount, value.currency)}</span>
        </button>
      ))}
      {(config.showLink ?? true) && (
        <button type="button" className={styles.footer} onClick={goToCatalog}>
          View in catalog
        </button>
      )}
    </div>
  );
};
