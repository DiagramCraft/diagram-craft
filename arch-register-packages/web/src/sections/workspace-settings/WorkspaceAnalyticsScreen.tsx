import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import { useEntities } from '../../hooks/useEntities';
import { useWorkspaceAnalytics } from '../../hooks/useWorkspaceAnalytics';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { EntitySearchParams } from '../../routes/searchParams';
import { asEntityPublicId, entityDetailRoute } from '../../routes/publicObjectRoutes';
import styles from './WorkspaceAnalyticsScreen.module.css';
import {
  completenessSearch,
  activityAuditSearch,
  lifecycleSearch,
  ownershipGapSearch,
  schemaLifecycleSearch
} from './workspaceAnalyticsHelpers';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const StatCard = ({
  label,
  value,
  sub
}: {
  label: string;
  value: string | number;
  sub: string;
}) => (
  <div className={styles.card}>
    <div className={styles.cardLabel}>{label}</div>
    <div className={styles.cardValue}>{value}</div>
    <div className={styles.cardSub}>{sub}</div>
  </div>
);

type BarBucket = {
  count: number;
  percent: number;
  color: string | null;
  label?: string;
  onClick?: () => void;
};

const StackedBar = ({ buckets }: { buckets: BarBucket[] }) => {
  const visible = buckets.filter(b => b.count > 0);

  if (visible.length === 0) return <div className={styles.bar} />;

  const stops: string[] = [];
  const positions: number[] = [];
  let pos = 0;
  for (let i = 0; i < visible.length; i++) {
    const bucket = visible[i]!;
    const color = bucket.color ?? '#c7ced6';
    const isFirst = i === 0;
    const isLast = i === visible.length - 1;
    positions.push(pos);
    const end = Math.min(pos + bucket.percent, 100);
    stops.push(isFirst ? `${color} 0%` : `${color} calc(${pos}% + 1px)`);
    if (isLast) {
      stops.push(`${color} 100%`);
    } else {
      stops.push(
        `${color} calc(${end}% - 1px)`,
        `var(--base-bg) calc(${end}% - 1px)`,
        `var(--base-bg) calc(${end}% + 1px)`
      );
    }
    pos = end;
  }

  return (
    <div
      className={styles.bar}
      style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }}
    >
      {visible.map((bucket, index) => (
        <div
          key={bucket.label ?? index}
          role={bucket.onClick ? 'button' : undefined}
          tabIndex={bucket.onClick ? 0 : undefined}
          onClick={bucket.onClick}
          onKeyDown={
            bucket.onClick
              ? e => {
                  if (e.key === 'Enter' || e.key === ' ') bucket.onClick?.();
                }
              : undefined
          }
          className={styles.barOverlay}
          style={{
            left: `${positions[index]}%`,
            width: `${bucket.percent}%`,
            cursor: bucket.onClick ? 'pointer' : undefined
          }}
          title={
            bucket.label
              ? `${bucket.label}: ${bucket.count} (${bucket.percent.toFixed(1)}%)`
              : undefined
          }
        />
      ))}
    </div>
  );
};

const Section = ({
  title,
  sub,
  children
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) => (
  <section className={styles.section}>
    <div className={styles.sectionHead}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionSub}>{sub}</div>
    </div>
    {children}
  </section>
);

const EmptyState = ({ text }: { text: string }) => <div className={styles.empty}>{text}</div>;

const LifecycleSection = ({
  analytics,
  onNavigate
}: {
  analytics: WorkspaceAnalytics;
  onNavigate: (search: EntitySearchParams) => void;
}) => (
  <Section
    title="Lifecycle Breakdown"
    sub="Workspace-wide counts and percentages by lifecycle value."
  >
    <div className={styles.bucketList}>
      {analytics.lifecycleBreakdown.map(bucket => (
        <button
          key={bucket.lifecycleId ?? 'unassigned'}
          type="button"
          className={styles.bucketCard}
          onClick={() => onNavigate(lifecycleSearch(bucket.lifecycleId))}
        >
          <div className={styles.bucketMeta}>
            <span
              className={styles.bucketSwatch}
              style={{ background: bucket.color ?? '#98a2b3' }}
            />
            <span className={styles.bucketName}>{bucket.label}</span>
          </div>
          <div className={styles.bucketValue}>
            <span className={styles.bucketCount}>{bucket.count}</span>
            <span className={styles.bucketPct}>{formatPercent(bucket.percent)}</span>
          </div>
        </button>
      ))}
    </div>
  </Section>
);

const ActivityTrendsSection = ({
  analytics,
  onNavigate
}: {
  analytics: WorkspaceAnalytics;
  onNavigate: (operation: 'create' | 'update', startDate: string, endDate: string) => void;
}) => {
  const [windowDays, setWindowDays] = useState<30 | 90>(30);
  const buckets = windowDays === 30 ? analytics.activityTrends.days30 : analytics.activityTrends.days90;
  const maximum = Math.max(1, ...buckets.map(bucket => bucket.created + bucket.updated));

  return (
    <Section title="Activity trends" sub="Entity create and update activity from audit history.">
      <div className={styles.trendControls}>
        <div className={styles.trendLegend}>
          <span><i className={styles.createdSwatch} />Created</span>
          <span><i className={styles.updatedSwatch} />Updated</span>
        </div>
        <fieldset className={styles.windowToggle}>
          <legend className={styles.visuallyHidden}>Activity trend window</legend>
          {[30, 90].map(days => (
            <button
              key={days}
              type="button"
              className={windowDays === days ? styles.windowToggleActive : undefined}
              aria-pressed={windowDays === days}
              onClick={() => setWindowDays(days as 30 | 90)}
            >
              {days} days
            </button>
          ))}
        </fieldset>
      </div>
      <fieldset className={styles.activityChartGroup}>
        <legend className={styles.visuallyHidden}>{windowDays}-day entity activity trend</legend>
        <div
          className={styles.activityChart}
          style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(2px, 1fr))` }}
        >
          {buckets.map(bucket => {
            const total = bucket.created + bucket.updated;
            return (
              <div key={bucket.date} className={styles.activityDay} title={`${bucket.date}: ${bucket.created} created, ${bucket.updated} updated`}>
                <div className={styles.activityBars}>
                  {bucket.created > 0 && (
                    <button
                      type="button"
                      className={`${styles.activitySegment} ${styles.createdSegment}`}
                      style={{ height: `${(bucket.created / maximum) * 100}%` }}
                      aria-label={`${bucket.date}: ${bucket.created} entities created; view audit log`}
                      onClick={() => onNavigate('create', bucket.startDate, bucket.endDate)}
                    />
                  )}
                  {bucket.updated > 0 && (
                    <button
                      type="button"
                      className={`${styles.activitySegment} ${styles.updatedSegment}`}
                      style={{ height: `${(bucket.updated / maximum) * 100}%` }}
                      aria-label={`${bucket.date}: ${bucket.updated} entities updated; view audit log`}
                      onClick={() => onNavigate('update', bucket.startDate, bucket.endDate)}
                    />
                  )}
                  {total === 0 && <span className={styles.activityEmpty} />}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.trendRange}>{buckets[0]?.date} – {buckets.at(-1)?.date}</div>
    </Section>
  );
};

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings');

export const WorkspaceAnalyticsScreen = ({ analyticsView }: { analyticsView?: 'stale' }) => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const search = routeApi.useSearch();
  const { data: analytics, isLoading, isError } = useWorkspaceAnalytics(workspaceSlug, 90);

  const navigateToEntities = (search: EntitySearchParams) =>
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search
    });

  const navigateToActivity = (operation: 'create' | 'update', startDate: string, endDate: string) =>
    navigate({
      to: '/$workspaceSlug/settings',
      params: { workspaceSlug },
      search: activityAuditSearch(operation, startDate, endDate)
    });

  if (isLoading) return <EmptyState text="Loading analytics…" />;
  if (isError || analytics == null) return <EmptyState text="Analytics could not be loaded." />;

  const selectView = (view: 'overview' | 'stale') =>
    navigate({
      to: '/$workspaceSlug/settings',
      params: { workspaceSlug },
      search: {
        ...search,
        section: 'analytics',
        analyticsView: view === 'stale' ? 'stale' : undefined
      }
    });

  if (analyticsView === 'stale') {
    return <StaleEntityReport workspaceSlug={workspaceSlug} onSelectView={selectView} />;
  }

  return (
    <div className={styles.stack}>
      <AnalyticsTabs active="overview" onSelect={selectView} />
      <div className={styles.stats}>
        <StatCard
          label="Total entities"
          value={analytics.summary.totalEntities}
          sub={`${analytics.schemaUtilization.length} schemas defined`}
        />
        <StatCard
          label="With owner"
          value={formatPercent(analytics.summary.percentWithOwner)}
          sub="Entities assigned to a team"
        />
        <StatCard
          label="Completeness 80%+"
          value={formatPercent(analytics.summary.percentCompleteness80Plus)}
          sub="Using the existing completeness score"
        />
        <button
          type="button"
          className={`${styles.card} ${styles.cardButton}`}
          onClick={() => selectView('stale')}
        >
          <div className={styles.cardLabel}>Stale entities</div>
          <div className={styles.cardValue}>{analytics.stale.totalCount}</div>
          <div className={styles.cardSub}>
            {formatPercent(analytics.stale.percent)} not changed in the last 90 days
          </div>
        </button>
      </div>

      <ActivityTrendsSection analytics={analytics} onNavigate={navigateToActivity} />

      <LifecycleSection analytics={analytics} onNavigate={navigateToEntities} />

      <Section title="Coverage" sub="Distribution by schema and lifecycle.">
        {analytics.coverage.length === 0 ? (
          <EmptyState text="No schemas are available for this workspace." />
        ) : (
          <table className={`${styles.table} ${styles.fixedTable}`}>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Schema</th>
                <th>Lifecycle mix</th>
              </tr>
            </thead>
            <tbody>
              {analytics.coverage.map(row => (
                <tr key={row.schemaId}>
                  <td>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => navigateToEntities({ type: row.schemaId })}
                    >
                      {row.schemaName}
                    </button>
                  </td>
                  <td>
                    <StackedBar
                      buckets={row.lifecycleBuckets.map(b => ({
                        ...b,
                        onClick: () =>
                          navigateToEntities(schemaLifecycleSearch(row.schemaId, b.lifecycleId))
                      }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Completeness" sub="Field completeness distribution per schema.">
        <table className={`${styles.table} ${styles.fixedTable}`}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>Schema</th>
              <th>Completeness mix</th>
            </tr>
          </thead>
          <tbody>
            {analytics.completeness.map(row => (
              <tr key={row.schemaId}>
                <td>
                  {row.totalCount > 0 ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => navigateToEntities({ type: row.schemaId })}
                    >
                      {row.schemaName}
                    </button>
                  ) : (
                    row.schemaName
                  )}
                </td>
                <td>
                  <StackedBar
                    buckets={[
                      {
                        label: 'Below 50%',
                        count: row.below50Count,
                        percent: row.totalCount > 0 ? (row.below50Count / row.totalCount) * 100 : 0,
                        color: 'var(--error-fg)',
                        onClick:
                          row.below50Count > 0
                            ? () => navigateToEntities(completenessSearch(row.schemaId, 'below50'))
                            : undefined
                      },
                      {
                        label: '50–79%',
                        count: row.between50And79Count,
                        percent:
                          row.totalCount > 0 ? (row.between50And79Count / row.totalCount) * 100 : 0,
                        color: 'var(--warning-fg)',
                        onClick:
                          row.between50And79Count > 0
                            ? () =>
                                navigateToEntities(
                                  completenessSearch(row.schemaId, 'between50And79')
                                )
                            : undefined
                      },
                      {
                        label: '80%+',
                        count: row.above80Count,
                        percent: row.totalCount > 0 ? (row.above80Count / row.totalCount) * 100 : 0,
                        color: 'var(--green)'
                      }
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className={styles.sideBySide}>
        <Section title="Ownership Gaps" sub="Schemas with the most unowned entities.">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Schema</th>
                <th style={{ width: 120 }}>Missing</th>
                <th className={styles.right} style={{ width: 80 }}>
                  Percent
                </th>
              </tr>
            </thead>
            <tbody>
              {analytics.ownershipGaps.map(row => (
                <tr key={row.schemaId}>
                  <td>
                    {row.missingOwnerCount > 0 ? (
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => navigateToEntities(ownershipGapSearch(row.schemaId))}
                      >
                        {row.schemaName}
                      </button>
                    ) : (
                      row.schemaName
                    )}
                  </td>
                  <td>{row.missingOwnerCount}</td>
                  <td className={styles.right}>{formatPercent(row.missingOwnerPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Schema Utilisation" sub="Entity counts, including empty schemas.">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Schema</th>
                <th className={styles.right} style={{ width: 80 }}>
                  Entities
                </th>
              </tr>
            </thead>
            <tbody>
              {analytics.schemaUtilization.map(row => (
                <tr key={row.schemaId}>
                  <td>
                    {row.count > 0 ? (
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => navigateToEntities({ type: row.schemaId })}
                      >
                        {row.schemaName}
                      </button>
                    ) : (
                      row.schemaName
                    )}
                  </td>
                  <td className={styles.right}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
};

const AnalyticsTabs = ({
  active,
  onSelect
}: {
  active: 'overview' | 'stale';
  onSelect: (view: 'overview' | 'stale') => void;
}) => (
  <div className={styles.tabs} role="tablist" aria-label="Analytics views">
    <button
      type="button"
      role="tab"
      aria-selected={active === 'overview'}
      className={active === 'overview' ? styles.tabActive : styles.tab}
      onClick={() => onSelect('overview')}
    >
      Overview
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={active === 'stale'}
      className={active === 'stale' ? styles.tabActive : styles.tab}
      onClick={() => onSelect('stale')}
    >
      Stale entities
    </button>
  </div>
);

const StaleEntityReport = ({
  workspaceSlug,
  onSelectView
}: {
  workspaceSlug: string;
  onSelectView: (view: 'overview' | 'stale') => void;
}) => {
  const navigate = useNavigate();
  const [thresholdInput, setThresholdInput] = useState('90');
  const [staleAfterDays, setStaleAfterDays] = useState(90);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 25;
  const { data: analytics, isLoading, isError } = useWorkspaceAnalytics(workspaceSlug, staleAfterDays);
  const conditions = analytics
    ? [{ fieldId: '_updatedAt', op: 'before' as const, value: analytics.stale.cutoffAt }]
    : [];
  const { data: entities = [], isLoading: isLoadingEntities } = useEntities(
    workspaceSlug,
    { conditions, view: 'summary', limit: pageSize, offset: pageIndex * pageSize },
    { enabled: analytics != null }
  );

  const applyThreshold = () => {
    const value = Number(thresholdInput);
    if (Number.isInteger(value) && value >= 1 && value <= 3650) {
      setStaleAfterDays(value);
      setThresholdInput(String(value));
      setPageIndex(0);
    }
  };

  if (isLoading) return <EmptyState text="Loading stale entities…" />;
  if (isError || analytics == null) return <EmptyState text="Stale entities could not be loaded." />;

  return (
    <div className={styles.stack}>
      <AnalyticsTabs active="stale" onSelect={onSelectView} />

      <div className={styles.staleReportControls}>
        <div className={styles.reportSub}>
          {analytics.stale.totalCount} entities not changed in the last {analytics.stale.thresholdDays} days.
        </div>
        <label className={styles.staleLabel}>
          Not changed in
          <input
            className={styles.thresholdInput}
            type="number"
            min={1}
            max={3650}
            step={1}
            value={thresholdInput}
            onChange={event => setThresholdInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') applyThreshold();
            }}
          />
          days
        </label>
        <button type="button" className={styles.applyButton} onClick={applyThreshold}>
          Apply
        </button>
      </div>

      <div className={styles.entityTableWrap}>
        {isLoadingEntities ? (
          <EmptyState text="Loading entities…" />
        ) : entities.length === 0 ? (
          <EmptyState text="No entities match this age threshold." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {entities.map(entity => (
                <tr
                  key={entity._uid}
                  className={styles.entityRow}
                  onClick={() =>
                    navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
                  }
                >
                  <td>{entity._name}</td>
                  <td>{entity._schema.name}</td>
                  <td>{entity._updatedAt ? new Date(entity._updatedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {analytics.stale.totalCount > pageSize && (
        <div className={styles.pagination}>
          <span>
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, analytics.stale.totalCount)} of{' '}
            {analytics.stale.totalCount}
          </span>
          <div>
            <button
              type="button"
              className={styles.applyButton}
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(index => index - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              className={styles.applyButton}
              disabled={(pageIndex + 1) * pageSize >= analytics.stale.totalCount}
              onClick={() => setPageIndex(index => index + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
