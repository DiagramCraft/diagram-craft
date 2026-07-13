import styles from './WorkspaceAnalyticsScreen.module.css';

export const AnalyticsTabs = ({
  active,
  onSelect
}: {
  active: 'overview' | 'stale';
  onSelect: (view: 'overview' | 'stale') => void;
}) => (
  <div className={styles.tabs} role="tablist" aria-label="Analytics views">
    <button
      type="button"
      role="tab"
      aria-selected={active === 'overview'}
      className={active === 'overview' ? styles.tabActive : styles.tab}
      onClick={() => onSelect('overview')}
    >
      Overview
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={active === 'stale'}
      className={active === 'stale' ? styles.tabActive : styles.tab}
      onClick={() => onSelect('stale')}
    >
      Stale entities
    </button>
  </div>
);
