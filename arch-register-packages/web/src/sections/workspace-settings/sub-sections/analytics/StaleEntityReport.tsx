import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEntities } from '../../../../hooks/useEntities';
import { useWorkspaceAnalytics } from '../../../../hooks/useWorkspaceAnalytics';
import { asEntityPublicId, entityDetailRoute } from '../../../../routes/publicObjectRoutes';
import styles from './WorkspaceAnalyticsScreen.module.css';
import { EmptyState } from './analyticsPrimitives';
import { AnalyticsTabs } from './AnalyticsTabs';
import { formatDate } from '../../../../utils/dateFormat';

export const StaleEntityReport = ({
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
                  <td>{formatDate(entity._updatedAt)}</td>
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
