import { useMemo } from 'react';
import { useQueryTextEntities } from '../../../hooks/useEntityQueryText';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { scalarValues } from '../../../lib/scalarFieldValues';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { formatMeasured, measuredValue } from '../../shared/data/fieldAggregation';
import { buildUpcomingRows, countdownTone, formatCountdown } from './upcomingByDateLogic';
import rowStyles from '../../shared/dashboard/WidgetRowList.module.css';
import styles from './UpcomingByDate.module.css';
import { UpcomingByDateWidgetConfig } from './types';

const DEFAULT_LIMIT = 7;

const TONE_COLOR = {
  normal: undefined,
  warn: 'var(--cmp-fg-warning, #eab308)',
  crit: 'var(--cmp-fg-danger, #ef4444)'
} as const;

type Props = { config: UpcomingByDateWidgetConfig };

/** Records ordered by an upcoming date, each with a countdown - e.g. renewals, expiries, reviews. */
export const UpcomingByDateWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const { data, isLoading } = useQueryTextEntities(workspaceSlug, config.query);

  const rows = useMemo(
    () =>
      buildUpcomingRows(data?.entities ?? [], {
        dateFieldId: config.dateFieldId,
        windowDays: config.windowDays,
        includeOverdue: config.includeOverdue,
        limit: config.limit ?? DEFAULT_LIMIT
      }),
    [data, config]
  );

  const sublabelField = useMemo(() => {
    if (!config.sublabelFieldId) return undefined;
    const first = rows[0]?.record;
    const schemaId = first?._schemaId ?? (first?._schema as { id?: string } | undefined)?.id;
    return schemas
      .find(schema => schema.id === schemaId)
      ?.fields.find(field => field.id === config.sublabelFieldId);
  }, [schemas, rows, config.sublabelFieldId]);
  const sublabelIsReference =
    sublabelField?.type === 'reference' || sublabelField?.type === 'containment';

  const referencedIds = useMemo(
    () =>
      sublabelIsReference
        ? rows.flatMap(row =>
            scalarValues(row.record[config.sublabelFieldId!]).filter(
              (value): value is string => typeof value === 'string'
            )
          )
        : [],
    [rows, sublabelIsReference, config.sublabelFieldId]
  );
  const referenced = useEntitiesByIds(workspaceSlug, referencedIds);

  if (isLoading) return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  if (data?.ok === false) {
    return <div className={`${rowStyles.emptyInline} dim`}>This widget's query is not valid.</div>;
  }
  if (rows.length === 0) {
    return <div className={`${rowStyles.emptyInline} dim`}>Nothing upcoming.</div>;
  }

  const sublabelOf = (record: Record<string, unknown>): string | undefined => {
    if (!config.sublabelFieldId) return undefined;
    const values = scalarValues(record[config.sublabelFieldId]);
    const text = values
      .map(value =>
        sublabelIsReference && typeof value === 'string'
          ? referenced.get(value)?.name
          : typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : undefined
      )
      .filter((value): value is string => !!value)
      .join(', ');
    return text === '' ? undefined : text;
  };

  return (
    <div className={rowStyles.list}>
      {rows.map(({ record, days }) => {
        const sublabel = sublabelOf(record);
        const value = config.valueFieldId ? measuredValue(record[config.valueFieldId]) : undefined;
        return (
          <button
            key={String(record._uid)}
            type="button"
            className={`${rowStyles.row} ${styles.row}`}
            onClick={() => openEntityDrawer(String(record._publicId))}
          >
            <span className={styles.text}>
              <span className={rowStyles.rowLabel}>{String(record._name)}</span>
              {sublabel && <span className={`${rowStyles.rowSub} dim`}>{sublabel}</span>}
            </span>
            {value && (
              <span className={`${rowStyles.rowMeta} mono`}>
                {formatMeasured(value.amount, value.currency)}
              </span>
            )}
            <span
              className={styles.countdown}
              style={{
                color: TONE_COLOR[countdownTone(days, config.warnWithinDays, config.critWithinDays)]
              }}
            >
              {formatCountdown(days)}
            </span>
          </button>
        );
      })}
    </div>
  );
};
