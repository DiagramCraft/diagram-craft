import styles from '../../shell/SidePanel.module.css';

const SectionHeader = ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
  <div className={`${styles.header} ${styles.tabHeader}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
    </div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </div>
);

export const SearchSidebar = () => (
  <>
    <SectionHeader title="Search" />
    <div className={styles.scroll} style={{ padding: 8 }}>
      <div className="dim">Type in the top bar to search.</div>
    </div>
  </>
);
