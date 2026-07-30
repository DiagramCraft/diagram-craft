import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import type { EntitySearchParams } from '../../../../routes/searchParams';
import styles from './WorkspaceAnalyticsScreen.module.css';
import { Section, formatPercent } from './analyticsPrimitives';
import { lifecycleSearch } from './workspaceAnalyticsHelpers';

export const LifecycleSection = ({
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
