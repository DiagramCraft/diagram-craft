import { useMemo } from 'react';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { BarList } from '../../../components/BarList';
import { ratioColor } from '../../../components/bandColor';
import { buildRatioBarRows } from './ratioBarListLogic';
import styles from './WidgetRowList.module.css';

const FETCH_LIMIT = 500;

export type RatioBarListWidgetConfig = {
  schemaName: string;
  /** Field whose value defines a bar (one bar per distinct value). */
  groupByFieldId: string;
  /** A bar's filled share is the entities with `numeratorFieldId = numeratorValue`. */
  numeratorFieldId: string;
  numeratorValue: string;
  label?: string;
};

type Props = {
  config: RatioBarListWidgetConfig;
};

export const isRatioBarListConfigComplete = (config: RatioBarListWidgetConfig): boolean =>
  !!config.schemaName &&
  !!config.groupByFieldId &&
  !!config.numeratorFieldId &&
  !!config.numeratorValue;

/**
 * Generic ratio/coverage bar-list: one bar per distinct value of a field, filled to the share of
 * that group's entities matching a numerator field value, coloured by `ratioColor`.
 */
export const RatioBarListWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);
  const enabled = !!workspaceSlug && !!schema && isRatioBarListConfigComplete(config);

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    { schemaId: schema?.id, limit: FETCH_LIMIT },
    { enabled }
  );

  const rows = useMemo(
    () =>
      buildRatioBarRows(entities, schema, {
        groupByFieldId: config.groupByFieldId,
        numeratorFieldId: config.numeratorFieldId,
        numeratorValue: config.numeratorValue
      }),
    [entities, schema, config.groupByFieldId, config.numeratorFieldId, config.numeratorValue]
  );

  if (!isRatioBarListConfigComplete(config) || (!schema && schemas.length > 0)) {
    return <div className={`${styles.emptyInline} dim`}>This widget is not fully configured.</div>;
  }
  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading…</div>;
  }

  return (
    <BarList
      rows={rows}
      getColor={row => ratioColor(row.effective, row.total)}
      emptyMessage="No entities."
    />
  );
};
