import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { useEntityCount } from '../../../hooks/useEntities';
import { useQueryTextCount } from '../../../hooks/useEntityQueryText';
import { orpcClient } from '../../../lib/orpcClient';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  formatStatValue,
  isQueryStatConfig,
  renderStatSubtext,
  statNumericValue,
  statTone,
  type AggregateStatDisplay,
  type AggregateStatSeverity
} from './aggregateStatQuery';
import styles from './AggregateStatWidget.module.css';

export type AggregateStatWidgetConfig = {
  /** Query-mode: entity-query DSL text whose matching-record count is the stat's value. */
  query?: string;
  /** Query-mode: when set, `percent`/`ofTotal` divide `query`'s count by this query's count. */
  denominatorQuery?: string;
  display?: AggregateStatDisplay;
  /** Query-mode: optional second count, available as `{sub}` in `subtextTemplate`. */
  subtextQuery?: string;
  subtextTemplate?: string;
  severity?: AggregateStatSeverity;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  numeratorCondition?: FilterCondition;
  label?: string;
  showLink?: boolean;
};

type Props = {
  config: AggregateStatWidgetConfig;
};

export const AggregateStatWidget = ({ config }: Props) =>
  isQueryStatConfig(config) ? (
    <QueryStat config={config} />
  ) : (
    <LegacyAggregateStat config={config} />
  );

const TONE_COLOR = {
  normal: undefined,
  warn: 'var(--cmp-fg-warning, #eab308)',
  crit: 'var(--cmp-fg-danger, #ef4444)'
} as const;

const QueryStat = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const showLink = config.showLink ?? true;
  const display = config.display ?? 'count';
  const query = config.query ?? '';
  const needsDenominator = display !== 'count' && !!config.denominatorQuery?.trim();

  const matched = useQueryTextCount(workspaceSlug, query);
  const total = useQueryTextCount(workspaceSlug, config.denominatorQuery ?? '', needsDenominator);
  const sub = useQueryTextCount(
    workspaceSlug,
    config.subtextQuery ?? '',
    !!config.subtextQuery?.trim()
  );

  if (matched.isLoading || (needsDenominator && total.isLoading)) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }
  if (matched.data?.ok !== true) {
    return <div className={`${styles.message} dim`}>This widget's query is not valid.</div>;
  }

  const matchedCount = matched.data.total;
  const totalCount = total.data?.ok === true ? total.data.total : undefined;
  const subCount = sub.data?.ok === true ? sub.data.total : undefined;
  const tone = statTone(statNumericValue(display, matchedCount, totalCount), config.severity);
  const subtext =
    renderStatSubtext(config.subtextTemplate, subCount, matchedCount, totalCount) ??
    (display === 'ofTotal' && totalCount !== undefined ? `of ${totalCount}` : undefined);

  const openInBrowser = async () => {
    const parsed = await orpcClient.entityQueryText.parseText({
      params: { workspace: workspaceSlug },
      query: { text: query }
    });
    if (!parsed.ok) return;
    const entityQuery = JSON.stringify(parsed.query);
    if (parsed.query.root_kind === 'relation') {
      navigate({
        to: '/$workspaceSlug/entities/relations',
        params: { workspaceSlug },
        search: { entityQuery }
      });
    } else {
      navigate({
        to: '/$workspaceSlug/entities',
        params: { workspaceSlug },
        search: { entityQuery }
      });
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.number} style={{ color: TONE_COLOR[tone] }}>
        {formatStatValue(display, matchedCount, totalCount)}
      </div>
      {config.label && <div className={styles.label}>{config.label}</div>}
      {subtext && <div className={styles.sub}>{subtext}</div>}
      {showLink && (
        <button type="button" className={styles.viewLink} onClick={() => void openInBrowser()}>
          View in catalog <TbArrowRight size={12} />
        </button>
      )}
    </div>
  );
};

const LegacyAggregateStat = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const showLink = config.showLink ?? true;

  const baseFilter = {
    schemaId: config.schema,
    owner: config.owner || undefined,
    lifecycle: config.lifecycle || undefined
  };
  const hasSchema = !!config.schema;
  const hasCondition = !!config.numeratorCondition;

  const { data: denominator, isLoading: loadingTotal } = useEntityCount(workspaceSlug, baseFilter, {
    enabled: !!workspaceSlug && hasSchema
  });
  const { data: numerator, isLoading: loadingMatch } = useEntityCount(
    workspaceSlug,
    { ...baseFilter, conditions: config.numeratorCondition ? [config.numeratorCondition] : [] },
    { enabled: !!workspaceSlug && hasSchema && hasCondition }
  );

  if (!hasSchema || !hasCondition) {
    return <div className={`${styles.message} dim`}>This widget is not fully configured.</div>;
  }

  if (loadingTotal || loadingMatch) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const total = denominator?.total ?? 0;
  const matched = numerator?.total ?? 0;
  const percent = total > 0 ? Math.round((matched / total) * 100) : 0;
  const schemaName = schemas.find(s => s.id === config.schema)?.name ?? config.schema;
  const displayLabel = config.label ?? schemaName;

  return (
    <div className={styles.card}>
      <div className={styles.number}>{percent}%</div>
      <div className={styles.label}>{displayLabel}</div>
      {showLink && (
        <button
          type="button"
          className={styles.viewLink}
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/entities',
              params: { workspaceSlug },
              search: {
                filters: JSON.stringify([
                  { fieldId: '_schemaId', op: 'equals' as const, value: config.schema }
                ])
              }
            })
          }
        >
          View in catalog <TbArrowRight size={12} />
        </button>
      )}
    </div>
  );
};
