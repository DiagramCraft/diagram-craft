import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { useAtRiskIntegrations } from '../useAtRiskIntegrations';
import styles from './ApiIntegrationCatalogPanels.module.css';

type Props = {
  workspaceId: string;
  onViewIntegrations: () => void;
  limit?: number;
  embedded?: boolean;
};

/**
 * The Overview section's "Integrations needing attention" panel (#3458) — extracted from
 * the former Overview screen's inline JSX into a standalone, self-fetching
 * component matching `ApiBlastRadiusPanel.tsx`'s shape. Distinguishes "Data Flow not configured"
 * from "configured, nothing at risk" with separate empty-state copy, matching prior behavior.
 */
export const ApiIntegrationCatalogAtRiskPanel = ({
  workspaceId,
  onViewIntegrations,
  limit = 8,
  embedded = false
}: Props) => {
  const atRisk = useAtRiskIntegrations(workspaceId, limit);

  return (
    <div className={embedded ? undefined : styles.panel}>
      {!embedded && (
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Integrations needing attention</span>
          <button type="button" className={styles.panelLink} onClick={onViewIntegrations}>
            All integrations
          </button>
        </div>
      )}
      <div className={styles.stack}>
        {atRisk.status === 'loading' ? (
          <div className={styles.row}>
            <LoadingState text="Loading integrations…" size="sm" />
          </div>
        ) : atRisk.status === 'error' ? (
          <div className={styles.row}>
            <Banner variant="error">Could not load integrations.</Banner>
          </div>
        ) : !atRisk.dataFlowConfigured ? (
          <div className={styles.row}>
            <EmptyState title="Data Flow not configured" compact />
          </div>
        ) : atRisk.items.length === 0 ? (
          <div className={styles.row}>
            <EmptyState title="No relation crosses a boundary or carries restricted data" compact />
          </div>
        ) : (
          atRisk.items.map(({ relation, crossesBoundary, restricted }) => (
            <div key={relation._uid} className={styles.row} style={{ cursor: 'default' }}>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>
                  {relation._in.name} → {relation._out.name}
                </span>
                <span className={`${styles.rowSub} dim`}>
                  {crossesBoundary && restricted
                    ? 'crosses a boundary · restricted data'
                    : crossesBoundary
                      ? 'crosses a boundary'
                      : 'restricted data'}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
