import { useNavigate } from '@tanstack/react-router';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import { useWorkspaceAnalytics } from '../../hooks/useWorkspaceAnalytics';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from './WorkspaceAnalyticsScreen.module.css';
import { lifecycleSearch, ownershipGapSearch } from './workspaceAnalyticsHelpers';

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
  buckets: Array<{ count: number; percent: number; color: string | null; label?: string }>;
}) => {
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
          // biome-ignore lint/suspicious/noArrayIndexKey: bar segments are positional
          key={index}
          className={styles.barOverlay}
          style={{ left: `${positions[index]}%`, width: `${bucket.percent}%` }}
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
  onNavigate: (search: Record<string, unknown>) => void;
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
                      buckets={row.lifecycleBuckets.map(b => ({ ...b, label: b.label }))}
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
                <td>{row.schemaName}</td>
                <td>
                  <StackedBar
                    buckets={[
                      {
                        label: 'Below 50%',
                        count: row.below50Count,
                        percent: row.totalCount > 0 ? (row.below50Count / row.totalCount) * 100 : 0,
                        color: 'var(--error-fg)'
                      },
                      {
                        label: '50–79%',
                        count: row.between50And79Count,
                        percent:
                          row.totalCount > 0 ? (row.between50And79Count / row.totalCount) * 100 : 0,
                        color: 'var(--warning-fg)'
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
