import { useMemo } from 'react';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { StackedBar } from '../../workspace-settings/sub-sections/analytics/analyticsPrimitives';
import { buildCountBuckets } from './countByFieldLogic';
import styles from './CountByFieldWidget.module.css';
import rowStyles from './WidgetRowList.module.css';

const FETCH_LIMIT = 1000;

const PALETTE = ['var(--accent-fg)', 'var(--green)', 'var(--warning-fg)', 'var(--text-muted)'];

export type CountByFieldWidgetConfig = {
  schemaName: string;
  /** Field whose distinct values define the bar segments. */
  fieldId: string;
  label?: string;
};

type Props = {
  config: CountByFieldWidgetConfig;
};

export const isCountByFieldConfigComplete = (config: CountByFieldWidgetConfig): boolean =>
  !!config.schemaName && !!config.fieldId;

/** Generic breakdown: total entity count plus a stacked bar and legend per value of a field. */
export const CountByFieldWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);
  const enabled = !!workspaceSlug && !!schema && isCountByFieldConfigComplete(config);

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    { schemaId: schema?.id, limit: FETCH_LIMIT },
    { enabled }
  );

  const buckets = useMemo(
    () => buildCountBuckets(entities, schema, config.fieldId),
    [entities, schema, config.fieldId]
  );

  if (!isCountByFieldConfigComplete(config) || (!schema && schemas.length > 0)) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
  if (isLoading) {
    return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  }
  if (entities.length === 0) {
    return <div className={`${rowStyles.emptyInline} dim`}>No entities.</div>;
  }

  const colored = buckets.map((bucket, index) => ({
    ...bucket,
    color: PALETTE[index % PALETTE.length]!
  }));

  return (
    <div className={styles.root}>
      <div className={styles.total}>{entities.length}</div>
      <StackedBar buckets={colored} />
      <div className={styles.legend}>
        {colored.map(bucket => (
          <span key={bucket.id} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: bucket.color }} />
            {bucket.label} {bucket.count}
          </span>
        ))}
      </div>
    </div>
  );
};
