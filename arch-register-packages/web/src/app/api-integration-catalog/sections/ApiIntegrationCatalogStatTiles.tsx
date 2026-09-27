import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { useApiIntegrationCatalogStatTiles } from '../useApiIntegrationCatalogStatTiles';
import styles from './ApiIntegrationCatalogStatTiles.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

type Props = { workspaceId: string };

/**
 * The Overview section's 4 stat tiles (#3458) — extracted from
 * `ApiIntegrationCatalogOverviewScreen.tsx`'s former inline JSX into a standalone, self-fetching
 * component matching `ApiBlastRadiusPanel.tsx`'s shape.
 */
export const ApiIntegrationCatalogStatTiles = ({ workspaceId }: Props) => {
  const stats = useApiIntegrationCatalogStatTiles(workspaceId);

  if (stats.status === 'loading') {
    return <LoadingState text="Loading stats…" size="sm" />;
  }
  if (stats.status === 'error') {
    return <Banner variant="error">Could not load catalog statistics.</Banner>;
  }

  return (
    <div className={styles.tiles}>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>Needs attention</div>
        <div
          className={styles.tileValue}
          style={stats.needsAttentionCount ? { color: WARN } : undefined}
        >
          {stats.needsAttentionCount}
        </div>
        <div className={styles.tileSub}>open change &amp; deprecation cases</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>Crossing a boundary</div>
        <div className={styles.tileValue} style={stats.crossingCount ? { color: WARN } : undefined}>
          {stats.dataFlowConfigured ? stats.crossingCount : '—'}
        </div>
        <div className={styles.tileSub}>
          {stats.dataFlowConfigured
            ? 'source and destination regions differ'
            : 'Data Flow not configured'}
        </div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>Carrying restricted data</div>
        <div
          className={styles.tileValue}
          style={stats.restrictedCount ? { color: DANGER } : undefined}
        >
          {stats.dataFlowConfigured ? stats.restrictedCount : '—'}
        </div>
        <div className={styles.tileSub}>
          {stats.dataFlowConfigured
            ? `${stats.highlySensitiveCount} highly sensitive`
            : 'Data Flow not configured'}
        </div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>Provider/consumer gaps</div>
        <div className={styles.tileValue} style={stats.gapPairs ? { color: DANGER } : undefined}>
          {stats.dataFlowConfigured ? stats.gapPairs : '—'}
        </div>
        <div className={styles.tileSub}>
          {stats.dataFlowConfigured
            ? `${stats.coveredPairs} of ${stats.applicablePairs} covered`
            : 'Data Flow not configured'}
        </div>
      </div>
    </div>
  );
};
