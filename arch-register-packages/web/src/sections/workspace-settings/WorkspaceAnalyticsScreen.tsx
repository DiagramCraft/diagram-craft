import { useNavigate } from '@tanstack/react-router';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import { useWorkspaceAnalytics } from '../../hooks/useWorkspaceAnalytics';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from './WorkspaceAnalyticsScreen.module.css';
import {
  completenessSearch,
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

const StackedBar = ({
  buckets
}: {
  buckets: Array<{ count: number; percent: number; color: string | null }>;
}) => (
  <div className={styles.bar}>
    {buckets.map((bucket, index) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: analytics buckets are static and ordered
        key={index}
        className={styles.barSegment}
        style={{
          width: `${bucket.percent}%`,
          background: bucket.count === 0 ? 'transparent' : (bucket.color ?? '#c7ced6')
        }}
      />
    ))}
  </div>
);

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
  onNavigate: (search: Record<string, unknown>) => void;
}) => (
  <Section title="Lifecycle Breakdown" sub="Workspace-wide counts and percentages by lifecycle value.">
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
              style={{ ['--bucket-color' as string]: bucket.color ?? '#98a2b3' }}
            />
            <div>{bucket.label}</div>
          </div>
          <div className={styles.bucketValue}>
            <div>{bucket.count}</div>
            <div>{formatPercent(bucket.percent)}</div>
          </div>
        </button>
      ))}
    </div>
  </Section>
);

export const WorkspaceAnalyticsScreen = () => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const { data: analytics, isLoading, isError } = useWorkspaceAnalytics(workspaceSlug);

  const navigateToEntities = (search: Record<string, unknown>) =>
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search
    });

  if (isLoading) return <EmptyState text="Loading analytics…" />;
  if (isError || analytics == null) return <EmptyState text="Analytics could not be loaded." />;

  return (
    <div className={styles.stack}>
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
      </div>

      <LifecycleSection analytics={analytics} onNavigate={navigateToEntities} />

      <Section title="Coverage" sub="Distribution by schema and lifecycle.">
        {analytics.coverage.length === 0 ? (
          <EmptyState text="No schemas are available for this workspace." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Schema</th>
                <th>Lifecycle mix</th>
                <th className={styles.right}>Entities</th>
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
                    <StackedBar buckets={row.lifecycleBuckets} />
                  </td>
                  <td className={styles.right}>{row.totalCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Ownership Gaps" sub="Schemas with the most unowned entities.">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Schema</th>
              <th className={styles.right}>Missing owner</th>
              <th className={styles.right}>Percent</th>
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
                <td className={styles.right}>{row.missingOwnerCount}</td>
                <td className={styles.right}>{formatPercent(row.missingOwnerPercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Completeness" sub="Counts by completeness bucket per schema.">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Schema</th>
              <th className={styles.right}>Below 50%</th>
              <th className={styles.right}>50-79%</th>
              <th className={styles.right}>80%+</th>
            </tr>
          </thead>
          <tbody>
            {analytics.completeness.map(row => (
              <tr key={row.schemaId}>
                <td>{row.schemaName}</td>
                <td className={styles.right}>
                  {row.below50Count > 0 ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => navigateToEntities(completenessSearch(row.schemaId, 'below50'))}
                    >
                      {row.below50Count}
                    </button>
                  ) : (
                    0
                  )}
                </td>
                <td className={styles.right}>
                  {row.between50And79Count > 0 ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() =>
                        navigateToEntities(completenessSearch(row.schemaId, 'between50And79'))
                      }
                    >
                      {row.between50And79Count}
                    </button>
                  ) : (
                    0
                  )}
                </td>
                <td className={styles.right}>{row.above80Count}</td>
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
              <th className={styles.right}>Entities</th>
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

      <Section title="Coverage Details" sub="Clickable lifecycle buckets for each schema.">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Schema</th>
              <th>Lifecycle buckets</th>
            </tr>
          </thead>
          <tbody>
            {analytics.coverage.map(row => (
              <tr key={`${row.schemaId}-buckets`}>
                <td>{row.schemaName}</td>
                <td>
                  {row.lifecycleBuckets
                    .filter(bucket => bucket.count > 0)
                    .map(bucket => (
                      <button
                        key={`${row.schemaId}-${bucket.lifecycleId ?? 'unassigned'}`}
                        type="button"
                        className={styles.linkButton}
                        onClick={() =>
                          navigateToEntities(schemaLifecycleSearch(row.schemaId, bucket.lifecycleId))
                        }
                        style={{ marginRight: 12 }}
                      >
                        {bucket.label} ({bucket.count})
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
};
