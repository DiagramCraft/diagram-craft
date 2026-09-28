import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { useApiIntegrationCatalogStatTiles } from '../useApiIntegrationCatalogStatTiles';
import styles from './ApiIntegrationCatalogStatTiles.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

export type ApiCatalogSingleTileKind = 'needs-attention' | 'pair-gaps';

type Props = { workspaceId: string; kind: ApiCatalogSingleTileKind };

/**
 * Bespoke single-tile widgets for the two Overview stats that are not a plain query count (the
 * case queue and provider/consumer pair coverage) — the escape hatch to the query-count
 * `AggregateStat` widget (#3463).
 */
export const ApiIntegrationCatalogSingleStatTile = ({ workspaceId, kind }: Props) => {
  const stats = useApiIntegrationCatalogStatTiles(workspaceId);

  if (stats.status === 'loading') return <LoadingState text="Loading stats…" size="sm" />;
  if (stats.status === 'error') {
    return <Banner variant="error">Could not load catalog statistics.</Banner>;
  }

  if (kind === 'needs-attention') {
    return (
      <div className={styles.tile} style={{ height: '100%' }}>
        <div className={styles.tileLabel}>Needs attention</div>
        <div
          className={styles.tileValue}
          style={stats.needsAttentionCount ? { color: WARN } : undefined}
        >
          {stats.needsAttentionCount}
        </div>
        <div className={styles.tileSub}>open change &amp; deprecation cases</div>
      </div>
    );
  }

  return (
    <div className={styles.tile} style={{ height: '100%' }}>
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
  );
};
