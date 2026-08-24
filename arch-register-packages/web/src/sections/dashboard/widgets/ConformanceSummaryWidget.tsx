import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import { useConformanceSummary } from '../../../hooks/useConformance';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import styles from './ConformanceSummaryWidget.module.css';

export type ConformanceSummaryWidgetConfig = Record<string, never>;

export const ConformanceSummaryWidget = ({
  config: _config
}: {
  config: ConformanceSummaryWidgetConfig;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const { data: summary, isLoading } = useConformanceSummary(
    workspaceSlug,
    permissions.canViewSchemas
  );

  if (!permissions.canViewSchemas) {
    return <div className={`${styles.message} dim`}>You do not have access to conformance.</div>;
  }
  if (isLoading || !summary) {
    return <div className={`${styles.message} dim`}>Loading conformance…</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.metrics}>
        <div>
          <strong>{summary.active}</strong>
          <span>active</span>
        </div>
        <div>
          <strong className={styles.toneDanger}>{summary.errors}</strong>
          <span>errors</span>
        </div>
        <div>
          <strong className={styles.toneWarn}>{summary.warnings}</strong>
          <span>warnings</span>
        </div>
        <div>
          <strong>{summary.acknowledged}</strong>
          <span>acknowledged</span>
        </div>
      </div>
      {(summary.byCheck.length > 0 || summary.bySchema.length > 0) && (
        <div className={styles.breakdowns}>
          {summary.byCheck.length > 0 && (
            <div className={styles.breakdown}>
              <div className={styles.breakdownTitle}>By check</div>
              {summary.byCheck.slice(0, 3).map(item => (
                <div className={styles.row} key={item.id}>
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          )}
          {summary.bySchema.length > 0 && (
            <div className={styles.breakdown}>
              <div className={styles.breakdownTitle}>By schema</div>
              {summary.bySchema.slice(0, 3).map(item => (
                <div className={styles.row} key={item.id}>
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.link}
        onClick={() =>
          navigate({
            to: '/$workspaceSlug/settings/$section',
            params: { workspaceSlug, section: 'conformance' }
          })
        }
      >
        Review conformance <TbArrowRight size={12} />
      </button>
    </div>
  );
};
