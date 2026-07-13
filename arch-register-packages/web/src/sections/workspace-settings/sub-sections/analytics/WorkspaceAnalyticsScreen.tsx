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
import { StatCard, StackedBar, Section, formatPercent } from './analyticsPrimitives';
import { AnalyticsTabs } from './AnalyticsTabs';
import { ActivityTrendsSection } from './ActivityTrendsSection';
import { LifecycleSection } from './LifecycleSection';
import { StaleEntityReport } from './StaleEntityReport';
import { Table } from '../../../../components/table/Table';
import { EmptyState } from '../../../../components/EmptyState';

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

  if (isLoading) return <EmptyState compact title="Loading analytics…" />;
  if (isError || analytics == null) return <EmptyState compact title="Analytics could not be loaded." />;

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
          <EmptyState compact title="No schemas are available for this workspace." />
        ) : (
          <Table.Root layout="fixed" bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell width={160}>Schema</Table.HeaderCell>
                <Table.HeaderCell>Lifecycle mix</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {analytics.coverage.map(row => (
                <Table.Row key={row.schemaId}>
                  <Table.Cell>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => navigateToEntities({ type: row.schemaId })}
                    >
                      {row.schemaName}
                    </button>
                  </Table.Cell>
                  <Table.Cell>
                    <StackedBar
                      buckets={row.lifecycleBuckets.map(b => ({
                        ...b,
                        onClick: () =>
                          navigateToEntities(schemaLifecycleSearch(row.schemaId, b.lifecycleId))
                      }))}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Section>

      <Section title="Completeness" sub="Field completeness distribution per schema.">
        <Table.Root layout="fixed" bordered={false}>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell width={160}>Schema</Table.HeaderCell>
              <Table.HeaderCell>Completeness mix</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {analytics.completeness.map(row => (
              <Table.Row key={row.schemaId}>
                <Table.Cell>
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
                </Table.Cell>
                <Table.Cell>
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
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Section>

      <div className={styles.sideBySide}>
        <Section title="Ownership Gaps" sub="Schemas with the most unowned entities.">
          <Table.Root bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Schema</Table.HeaderCell>
                <Table.HeaderCell width={120}>Missing</Table.HeaderCell>
                <Table.HeaderCell align="right" width={80}>
                  Percent
                </Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {analytics.ownershipGaps.map(row => (
                <Table.Row key={row.schemaId}>
                  <Table.Cell>
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
                  </Table.Cell>
                  <Table.Cell>{row.missingOwnerCount}</Table.Cell>
                  <Table.Cell align="right">{formatPercent(row.missingOwnerPercent)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Section>

        <Section title="Schema Utilisation" sub="Entity counts, including empty schemas.">
          <Table.Root bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Schema</Table.HeaderCell>
                <Table.HeaderCell align="right" width={80}>
                  Entities
                </Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {analytics.schemaUtilization.map(row => (
                <Table.Row key={row.schemaId}>
                  <Table.Cell>
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
                  </Table.Cell>
                  <Table.Cell align="right">{row.count}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Section>
      </div>
    </div>
  );
};
