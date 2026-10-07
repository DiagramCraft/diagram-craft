import { useMemo } from 'react';
import { bandTone, toneColor } from '../../../components/bandColor';
import { EntityHoverCard } from '../../../components/EntityHoverCard';
import { useEntities, useEntity } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { renderSchemaFieldValue } from '../../markdown/mdx-components/blocks/entity-card/EntityCard';
import { computeProgress, resolveRelatedEntities } from './relatedEntitiesLogic';
import styles from './RelatedEntitiesListWidget.module.css';
import rowStyles from './WidgetRowList.module.css';

const FETCH_LIMIT = 1000;

export type RelatedEntitiesListWidgetConfig = {
  /** Public id of the entity the list is scoped to; usually a sidebar variable reference. */
  entityId?: string;
  /** Entity type listed. */
  schemaName: string;
  /** Reference field on `schemaName` pointing at the scoping entity (or at the `via` entities). */
  referenceField: string;
  /** Optional intermediate hop: entities of this type reference the scoping entity through
   *  `viaReferenceField`, and the listed entities reference those. */
  viaSchemaName?: string;
  viaReferenceField?: string;
  descriptionField?: string;
  statusField?: string;
  /** When all three are set, each row shows a baseline → current → target progress bar. */
  progressBaselineField?: string;
  progressCurrentField?: string;
  progressTargetField?: string;
  progressUnitField?: string;
  label?: string;
  emptyMessage?: string;
};

const OPTIONAL_STRING_KEYS = [
  'entityId',
  'viaSchemaName',
  'viaReferenceField',
  'descriptionField',
  'statusField',
  'progressBaselineField',
  'progressCurrentField',
  'progressTargetField',
  'progressUnitField',
  'label',
  'emptyMessage'
] as const;

export const isRelatedEntitiesListConfigValid = (
  config: Record<string, unknown>
): config is RelatedEntitiesListWidgetConfig =>
  typeof config.schemaName === 'string' &&
  typeof config.referenceField === 'string' &&
  OPTIONAL_STRING_KEYS.every(key => config[key] === undefined || typeof config[key] === 'string');

export const isRelatedEntitiesListConfigComplete = (
  config: RelatedEntitiesListWidgetConfig
): boolean =>
  !!config.schemaName &&
  !!config.referenceField &&
  !config.viaSchemaName === !config.viaReferenceField;

const hasProgress = (config: RelatedEntitiesListWidgetConfig): boolean =>
  !!config.progressBaselineField && !!config.progressCurrentField && !!config.progressTargetField;

// Past 60% of the way to target reads as on track; below that, as needing attention.
const progressColor = (percent: number): string =>
  toneColor(
    bandTone(
      percent,
      [
        { max: 60, tone: 'warn' },
        { max: null, tone: 'good' }
      ],
      {
        exclusive: true
      }
    ) ?? 'neutral'
  );

const isUnresolved = (entityId: string | undefined): boolean =>
  !entityId || entityId.startsWith('$');

/**
 * Generic "related entities" list: the entities of one type that reference a scoping entity
 * (typically the dashboard sidebar's picked entity), optionally through one intermediate type.
 * Rows show name, optional status/description and an optional baseline → current → target
 * progress bar. Joins happen client-side over the `full` projection because the entity list's
 * `op: 'in'` filter does not match inside JSON-array `reference` columns.
 */
export const RelatedEntitiesListWidget = ({
  config
}: {
  config: RelatedEntitiesListWidgetConfig;
}) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const complete = isRelatedEntitiesListConfigComplete(config);
  const unresolved = isUnresolved(config.entityId);

  const schema = schemas.find(candidate => candidate.name === config.schemaName);
  const viaSchema = schemas.find(candidate => candidate.name === config.viaSchemaName);
  const enabled = !!workspaceSlug && complete && !unresolved;

  const target = useEntity(workspaceSlug, config.entityId ?? '', enabled);
  const listed = useEntities(
    workspaceSlug,
    { schemaId: schema?.id, view: 'full', limit: FETCH_LIMIT },
    { enabled: enabled && !!schema }
  );
  const via = useEntities(
    workspaceSlug,
    { schemaId: viaSchema?.id, view: 'full', limit: FETCH_LIMIT },
    { enabled: enabled && !!config.viaSchemaName && !!viaSchema }
  );

  const targetUid = target.data?._uid;
  const items = useMemo(() => {
    if (!targetUid) return [];
    const hops = [
      ...(config.viaSchemaName && config.viaReferenceField
        ? [{ entities: via.data, referenceField: config.viaReferenceField }]
        : []),
      { entities: listed.data, referenceField: config.referenceField }
    ];
    return resolveRelatedEntities(targetUid, hops);
  }, [
    targetUid,
    listed.data,
    via.data,
    config.referenceField,
    config.viaSchemaName,
    config.viaReferenceField
  ]);

  if (!complete || (!schema && schemas.length > 0)) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
  if (unresolved) {
    return <div className={`${rowStyles.emptyInline} dim`}>No item selected</div>;
  }
  if (target.isLoading || listed.isLoading || via.isLoading) {
    return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  }

  const emptyMessage = config.emptyMessage ?? 'Nothing related.';
  const fieldText = (entity: Record<string, unknown>, fieldId?: string): string | null => {
    const field = fieldId ? schema?.fields.find(f => f.id === fieldId) : undefined;
    return field ? renderSchemaFieldValue(field, entity[field.id]) : null;
  };

  if (items.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.stack}>
      {items.map(entity => {
        const status = fieldText(entity, config.statusField);
        const description = fieldText(entity, config.descriptionField);
        const progress = hasProgress(config)
          ? computeProgress(entity, {
              baselineField: config.progressBaselineField!,
              currentField: config.progressCurrentField!,
              targetField: config.progressTargetField!,
              unitField: config.progressUnitField
            })
          : null;
        return (
          <div key={entity._uid} className={styles.item}>
            <div className={styles.name}>
              <EntityHoverCard entityId={entity._uid}>{entity._name}</EntityHoverCard>
            </div>
            {(status || description) && (
              <div className={styles.meta}>
                {status && <span>{status}</span>}
                {description && <span>{description}</span>}
              </div>
            )}
            {hasProgress(config) &&
              (progress ? (
                <div className={styles.progress}>
                  <span className={styles.track}>
                    <span
                      className={styles.fill}
                      style={{
                        width: `${progress.percent}%`,
                        background: progressColor(progress.percent)
                      }}
                    />
                  </span>
                  <span title={`${progress.percent.toFixed(0)}% of the way to target`}>
                    {progress.label}
                  </span>
                </div>
              ) : (
                <span className="dim">—</span>
              ))}
          </div>
        );
      })}
    </div>
  );
};
