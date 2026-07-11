import { useNavigate, useSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import type { EntitySearchParams, SettingsSearchParams } from '../../../../routes/searchParams';
import { useWorkspaceAnalytics } from '../../../../hooks/useWorkspaceAnalytics';
import styles from './WorkspaceAnalyticsScreen.module.css';
import {
  completenessSearch,
  activityAuditSearch,
  ownershipGapSearch,
  schemaLifecycleSearch
} from './workspaceAnalyticsHelpers';
import { EmptyState, StatCard, StackedBar, Section, formatPercent } from './analyticsPrimitives';
import { AnalyticsTabs } from './AnalyticsTabs';
import { ActivityTrendsSection } from './ActivityTrendsSection';
import { LifecycleSection } from './LifecycleSection';
import { StaleEntityReport } from './StaleEntityReport';

export const WorkspaceAnalyticsScreen = ({ analyticsView }: { analyticsView?: 'stale' }) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const search = useSearch({ strict: false }) as SettingsSearchParams;
  const { data: analytics, isLoading, isError } = useWorkspaceAnalytics(workspaceSlug, 90);

  const navigateToEntities = (search: EntitySearchParams) =>
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search
    });

  const navigateToActivity = (operation: 'create' | 'update', startDate: string, endDate: string) =>
    navigate({
      to: '/$workspaceSlug/settings/$section',
      params: { workspaceSlug, section: 'audit' },
      search: activityAuditSearch(operation, startDate, endDate)
    });

  if (isLoading) return <EmptyState text="Loading analytics…" />;
  if (isError || analytics == null) return <EmptyState text="Analytics could not be loaded." />;

  const selectView = (view: 'overview' | 'stale') =>
    navigate({
      to: '/$workspaceSlug/settings/$section',
      params: { workspaceSlug, section: 'analytics' },
      search: {
        ...search,
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
