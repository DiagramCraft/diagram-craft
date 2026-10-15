import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEntities } from '../../../hooks/useEntities';
import { useRelations } from '../../../hooks/useRelations';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import {
  formatMeasured,
  measuredValue,
  type MeasuredValue
} from '../../shared/data/fieldAggregation';
import styles from '../../shared/dashboard/WidgetRowList.module.css';
import { TopEntitiesWidgetConfig } from './types';

const FETCH_LIMIT = 500;

type Props = {
  config: TopEntitiesWidgetConfig;
};

export const TopEntitiesWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schemaId =
    config.schema || schemas.find(candidate => candidate.name === config.schemaName)?.id || '';
  const hasConfig = !!schemaId;

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

  const relationSchemaId = useMemo(() => {
    if (!config.relationFieldName) return undefined;
    const field = schemas
      .find(candidate => candidate.id === schemaId)
      ?.fields.find(
        candidate =>
          candidate.id === config.relationFieldName || candidate.name === config.relationFieldName
      );
    return field?.type === 'typedRelation' ? field.relationSchemaId : undefined;
  }, [schemas, schemaId, config.relationFieldName]);
  const relations = useRelations(
    workspaceSlug,
    { schemaId: relationSchemaId, limit: FETCH_LIMIT },
    { enabled: !!workspaceSlug && relationSchemaId != null }
  );
  const isLoadingRelations = relationSchemaId != null && relations.isLoading;

  const direction = config.direction ?? 'desc';
  const limit = config.limit ?? 5;

  const ranked = useMemo(() => {
    const relationCounts = new Map<string, number>();
    for (const relation of relations.data) {
      relationCounts.set(relation._out.id, (relationCounts.get(relation._out.id) ?? 0) + 1);
    }
    const rankValue = (entity: (typeof entities)[number]): MeasuredValue | undefined =>
      config.relationFieldName
        ? { amount: relationCounts.get(entity._uid) ?? 0 }
        : measuredValue(entity[config.fieldId]);
    const withValue = entities
      .map(entity => ({ entity, value: rankValue(entity) }))
      .filter(
        (
          item
        ): item is {
          entity: (typeof entities)[number];
          value: MeasuredValue;
        } => item.value !== undefined
      );
    withValue.sort((a, b) =>
      direction === 'desc' ? b.value.amount - a.value.amount : a.value.amount - b.value.amount
    );
    return withValue.slice(0, limit);
  }, [entities, relations.data, config.fieldId, config.relationFieldName, direction, limit]);

  const shareTotal = ranked.reduce((sum, item) => sum + Math.max(item.value.amount, 0), 0);

  if (!hasConfig) {
    return <div className={`${styles.emptyInline} dim`}>This widget is not fully configured.</div>;
  }

  if (isLoading || isLoadingRelations) {
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

export const isDirection = (value: unknown): value is 'asc' | 'desc' =>
  value === 'asc' || value === 'desc';
