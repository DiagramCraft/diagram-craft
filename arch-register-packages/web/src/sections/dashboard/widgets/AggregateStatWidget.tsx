import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { useEntityCount } from '../../../hooks/useEntities';
import { useQueryTextEntities } from '../../../hooks/useEntityQueryText';
import { orpcClient } from '../../../lib/orpcClient';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  formatStatValue,
  renderStatSubtext,
  statNumericValue,
  statTone,
  aggregateStatDisplaySchema,
  aggregateStatSeveritySchema
} from './aggregateStatQuery';
import { countDistinctValues, formatMeasured, sumMeasured } from './fieldAggregation';
import styles from './AggregateStatWidget.module.css';
import { useWidgetBodyTitle } from './WidgetBodyTitle';

import { isQueryStatConfig } from './aggregateStatQuery';
import { useEffect, useState } from 'react';
import { getSchemaFieldDefs, FilterRow } from '../../../components/FilterBuilder';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { useQueryTextCount } from '../../../hooks/useEntityQueryText';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { AggregateStatDisplay } from './aggregateStatQuery';
import configFormStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';
import { withInitial } from '../../markdown/mdx-components/configSchema';

export const aggregateStatWidgetConfigSchema = z
  .object({
    /** Query-mode: entity-query DSL text whose matching-record count is the stat's value. */
    query: withInitial(z.string().optional(), ''),
    /** Query-mode: when set, `percent`/`ofTotal` divide `query`'s count by this query's count. */
    denominatorQuery: z.string().optional(),
    display: withInitial(aggregateStatDisplaySchema.optional(), 'count'),
    /**
     * Query-mode: `count` (default) shows the number of matching records; `sum` shows the total of
     * `sumFieldId` (a number or currency field) across them. Independently, `{subSum}` in
     * `subtextTemplate` is the `sumFieldId` total over `subtextQuery`'s records. `countDistinct`
     * shows how many distinct values `distinctFieldId` takes across the matching records. With
     * `display: 'percent'`, `sum` divides `query`'s sum by `denominatorQuery`'s sum.
     */
    measure: z.enum(['count', 'sum', 'countDistinct']).optional(),
    sumFieldId: z.string().optional(),
    distinctFieldId: z.string().optional(),
    /** Query-mode: optional second count, available as `{sub}` in `subtextTemplate`. */
    subtextQuery: z.string().optional(),
    subtextTemplate: z.string().optional(),
    severity: aggregateStatSeveritySchema.optional(),
    /** Legacy mode: the schema whose entities are counted. */
    schema: z.string().optional(),
    owner: z.string().optional(),
    lifecycle: z.string().optional(),
    /** Legacy mode: the entities matching this condition form the numerator. */
    numeratorCondition: filterConditionSchema.optional(),
    showLink: z.boolean().optional()
  })
  .superRefine((config, ctx) => {
    const require = (condition: boolean, path: string, message: string) => {
      if (!condition) ctx.addIssue({ code: 'custom', path: [path], message });
    };

    if (isQueryStatConfig(config)) {
      require(config.measure !== 'sum' || !!config.sumFieldId, 'sumFieldId', 'A sum needs a field');
      require(config.measure !== 'countDistinct' ||
        !!config.distinctFieldId, 'distinctFieldId', 'A distinct count needs a field');
      const needsDenominator = config.display === 'percent' || config.display === 'ofTotal';
      require(!needsDenominator ||
        !!config.denominatorQuery?.trim(), 'denominatorQuery', 'A percentage needs a denominator query');
    } else {
      require(!!config.schema, 'schema', 'Needs a schema or a query');
      require(!!config.numeratorCondition?.fieldId, 'numeratorCondition', 'Needs a numerator');
    }
  });

export type AggregateStatWidgetConfig = z.infer<typeof aggregateStatWidgetConfigSchema>;

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
  const title = useWidgetBodyTitle();
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const showLink = config.showLink ?? true;
  const display = config.display ?? 'count';
  const query = config.query ?? '';
  const needsDenominator = display !== 'count' && !!config.denominatorQuery?.trim();

  const isSum = config.measure === 'sum' && !!config.sumFieldId;
  const isDistinct = config.measure === 'countDistinct' && !!config.distinctFieldId;
  const needsMatchedEntities = isSum || isDistinct;
  const isSumPercent = isSum && display === 'percent';
  const subEnabled = !!config.subtextQuery?.trim();
  const needsSubSum = !!config.sumFieldId && subEnabled;

  const matched = useQueryTextCount(workspaceSlug, query);
  const matchedEntities = useQueryTextEntities(workspaceSlug, query, needsMatchedEntities);
  const totalEntities = useQueryTextEntities(
    workspaceSlug,
    config.denominatorQuery ?? '',
    isSumPercent && needsDenominator
  );
  const subEntities = useQueryTextEntities(workspaceSlug, config.subtextQuery ?? '', needsSubSum);
  const total = useQueryTextCount(workspaceSlug, config.denominatorQuery ?? '', needsDenominator);
  const sub = useQueryTextCount(
    workspaceSlug,
    config.subtextQuery ?? '',
    !!config.subtextQuery?.trim()
  );

  if (
    matched.isLoading ||
    (needsMatchedEntities && matchedEntities.isLoading) ||
    (isSumPercent && needsDenominator && totalEntities.isLoading) ||
    (needsSubSum && subEntities.isLoading) ||
    (needsDenominator && total.isLoading)
  ) {
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
  const sumOf = (entities: Array<Record<string, unknown>> | undefined) => {
    if (!entities || !config.sumFieldId) return undefined;
    const { amount, currency } = sumMeasured(entities, config.sumFieldId);
    return formatMeasured(amount, currency);
  };
  const matchedSum = isSum ? sumOf(matchedEntities.data?.entities) : undefined;
  const sumAmount = (entities: Array<Record<string, unknown>> | undefined) =>
    entities && config.sumFieldId ? sumMeasured(entities, config.sumFieldId).amount : undefined;
  // A spend-weighted percent divides sums rather than record counts.
  const numerator = isSumPercent ? (sumAmount(matchedEntities.data?.entities) ?? 0) : matchedCount;
  const denominator = isSumPercent ? sumAmount(totalEntities.data?.entities) : totalCount;
  const tone = statTone(statNumericValue(display, numerator, denominator), config.severity);
  const distinctCount = isDistinct
    ? countDistinctValues(matchedEntities.data?.entities ?? [], config.distinctFieldId!)
    : undefined;
  const subSum = needsSubSum ? sumOf(subEntities.data?.entities) : undefined;
  const subtext =
    renderStatSubtext(config.subtextTemplate, subCount, matchedCount, totalCount, subSum) ??
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
        {isSumPercent
          ? formatStatValue(display, numerator, denominator)
          : (matchedSum ??
            (distinctCount !== undefined
              ? String(distinctCount)
              : formatStatValue(display, matchedCount, totalCount)))}
      </div>
      {title && <div className={styles.label}>{title}</div>}
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
  const title = useWidgetBodyTitle();
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
  const displayLabel = title ?? schemaName;

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

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type AggregateStatConfigFormProps = {
  config: AggregateStatWidgetConfig;
  onChange: (config: AggregateStatWidgetConfig) => void;
};

const useDebounced = (value: string, delayMs = 400): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
};

const QueryField = ({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const debounced = useDebounced(value);
  const result = useQueryTextCount(workspaceSlug, debounced);
  const status =
    debounced.trim() === '' || result.isLoading
      ? undefined
      : result.data?.ok === true
        ? `Matches ${result.data.total} record${result.data.total === 1 ? '' : 's'}`
        : (result.data?.errors[0]?.message ?? 'Invalid query');
  return (
    <label className={configFormStyles.optionRow}>
      <span className={configFormStyles.optionLabel}>{label}</span>
      <div className={configFormStyles.optionControl}>
        <textarea
          className={configFormStyles.labelInput}
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
        {status && <div className={`${configFormStyles.hint} dim`}>{status}</div>}
      </div>
    </label>
  );
};

const QueryModeForm = ({ config, onChange }: AggregateStatConfigFormProps) => {
  const display = config.display ?? 'count';
  const showLink = config.showLink ?? true;
  const needsDenominator = display !== 'count';
  const numberOrUndefined = (value: string): number | undefined =>
    value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);
  return (
    <>
      <DialogSection label="Query">
        <div className={configFormStyles.options}>
          <QueryField
            label="Count records matching"
            value={config.query ?? ''}
            placeholder='e.g. schema:"Data Flow" AND cross_boundary = cross-boundary'
            onChange={query => onChange({ ...config, query })}
          />
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Show as</span>
            <div className={configFormStyles.optionControl}>
              <select
                value={display}
                onChange={e =>
                  onChange({ ...config, display: e.target.value as AggregateStatDisplay })
                }
              >
                <option value="count">Count</option>
                <option value="percent">Percent of total</option>
                <option value="ofTotal">Count, with "of total"</option>
              </select>
            </div>
          </label>
          {needsDenominator && (
            <QueryField
              label="Total records"
              value={config.denominatorQuery ?? ''}
              placeholder='e.g. schema:"Control"'
              onChange={denominatorQuery => onChange({ ...config, denominatorQuery })}
            />
          )}
        </div>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <QueryField
            label="Subtext count"
            value={config.subtextQuery ?? ''}
            placeholder="Optional second query, available as {sub}"
            onChange={subtextQuery =>
              onChange({ ...config, subtextQuery: optionalText(subtextQuery) })
            }
          />
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Measure</span>
            <div className={configFormStyles.optionControl}>
              <select
                className={configFormStyles.labelInput}
                value={config.measure ?? 'count'}
                onChange={e =>
                  onChange({
                    ...config,
                    measure:
                      e.target.value === 'sum' || e.target.value === 'countDistinct'
                        ? e.target.value
                        : undefined
                  })
                }
              >
                <option value="count">Count of records</option>
                <option value="sum">Sum of a field</option>
                <option value="countDistinct">Count of distinct values</option>
              </select>
            </div>
          </label>
          {config.measure === 'countDistinct' && (
            <label className={configFormStyles.optionRow}>
              <span className={configFormStyles.optionLabel}>Field to count</span>
              <div className={configFormStyles.optionControl}>
                <input
                  type="text"
                  className={configFormStyles.labelInput}
                  value={config.distinctFieldId ?? ''}
                  onChange={e =>
                    onChange({ ...config, distinctFieldId: optionalText(e.target.value) })
                  }
                  placeholder="Field id, e.g. cost_centre"
                />
              </div>
            </label>
          )}
          {(config.measure === 'sum' || config.subtextQuery?.trim()) && (
            <label className={configFormStyles.optionRow}>
              <span className={configFormStyles.optionLabel}>Field to sum</span>
              <div className={configFormStyles.optionControl}>
                <input
                  type="text"
                  className={configFormStyles.labelInput}
                  value={config.sumFieldId ?? ''}
                  onChange={e => onChange({ ...config, sumFieldId: optionalText(e.target.value) })}
                  placeholder="Number or currency field id, e.g. annual_cost"
                />
              </div>
            </label>
          )}
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Subtext</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="text"
                className={configFormStyles.labelInput}
                value={config.subtextTemplate ?? ''}
                onChange={e =>
                  onChange({ ...config, subtextTemplate: optionalText(e.target.value) })
                }
                placeholder="e.g. {sub} highly sensitive ({count}, {total}, {subSum} also available)"
              />
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Warn at</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                className={configFormStyles.labelInput}
                value={config.severity?.warnAt ?? ''}
                onChange={e =>
                  onChange({
                    ...config,
                    severity: { ...config.severity, warnAt: numberOrUndefined(e.target.value) }
                  })
                }
              />
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Critical at</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                className={configFormStyles.labelInput}
                value={config.severity?.critAt ?? ''}
                onChange={e =>
                  onChange({
                    ...config,
                    severity: { ...config.severity, critAt: numberOrUndefined(e.target.value) }
                  })
                }
              />
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Highlight when</span>
            <div className={configFormStyles.optionControl}>
              <select
                value={config.severity?.direction ?? 'above'}
                onChange={e =>
                  onChange({
                    ...config,
                    severity: {
                      ...config.severity,
                      direction: e.target.value === 'below' ? 'below' : 'above'
                    }
                  })
                }
              >
                <option value="above">Value is at or above the threshold</option>
                <option value="below">Value is at or below the threshold</option>
              </select>
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Show link</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="checkbox"
                checked={showLink}
                onChange={e => onChange({ ...config, showLink: e.target.checked })}
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};

export const AggregateStatConfigForm = ({ config, onChange }: AggregateStatConfigFormProps) => {
  if (typeof config.query === 'string')
    return <QueryModeForm config={config} onChange={onChange} />;
  return <LegacyAggregateStatConfigForm config={config} onChange={onChange} />;
};

const LegacyAggregateStatConfigForm = ({ config, onChange }: AggregateStatConfigFormProps) => {
  const { schemas, enums } = useWorkspaceContext();
  const schema = schemas.find(s => s.id === config.schema);
  const fields = getSchemaFieldDefs(schema, enums);
  const showLink = config.showLink ?? true;

  const filter: EntityFilterValue = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  };

  const defaultCondition: FilterCondition = {
    fieldId: fields[0]?.id ?? '',
    op: fields[0]?.type === 'select' ? 'equals' : 'not_empty',
    value: ''
  };

  return (
    <>
      <DialogSection label="Entity type">
        <EntityFilterPanel
          value={filter}
          onChange={update => {
            const next = { ...filter, ...update };
            onChange({
              ...config,
              schema: next.schemaId,
              owner: optionalText(next.owner),
              lifecycle: optionalText(next.lifecycle),
              // The numerator condition is scoped to the previously selected schema's fields -
              // reset it when the schema changes so it doesn't reference a stale field id.
              numeratorCondition:
                next.schemaId === config.schema ? config.numeratorCondition : undefined
            });
          }}
        />
      </DialogSection>
      <DialogSection label="Counts as met when">
        {!config.schema ? (
          <div className={`${configFormStyles.hint} dim`}>Choose an entity type first.</div>
        ) : (
          <FilterRow
            condition={config.numeratorCondition ?? defaultCondition}
            fields={fields}
            onUpdate={updates =>
              onChange({
                ...config,
                numeratorCondition: {
                  ...(config.numeratorCondition ?? defaultCondition),
                  ...updates
                }
              })
            }
            onRemove={() => onChange({ ...config, numeratorCondition: undefined })}
          />
        )}
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Show link</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="checkbox"
                checked={showLink}
                onChange={e => onChange({ ...config, showLink: e.target.checked })}
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
