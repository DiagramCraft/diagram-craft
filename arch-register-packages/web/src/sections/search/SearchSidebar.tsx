import styles from '../../shell/SidePanel.module.css';
import { SidebarHeader } from '../../components/sidebar/SidebarPrimitives';

export const SearchSidebar = () => (
  <>
    <SidebarHeader>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Search</span>
      </div>
    </SidebarHeader>
    <div className={styles.scroll} style={{ padding: 8 }}>
      <div className="dim">Type in the top bar to search.</div>
    </div>
  </>
);
