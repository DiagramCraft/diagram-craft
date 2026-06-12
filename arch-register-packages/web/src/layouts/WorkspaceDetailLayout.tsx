import { useEffect, useState, type ReactNode } from 'react';
import styles from './WorkspaceLayout.module.css';
import sidePanelStyles from '../shell/SidePanel.module.css';
import { FoldedRail, NavSidebar } from '../shell/FoldedRail';

type WorkspaceDetailLayoutProps = {
  rail: ReactNode;
  navigationLabel: string;
  renderNavigation: (controls: {
    expanded: boolean;
    expand: () => void;
    collapse: () => void;
  }) => ReactNode;
  secondarySidebar?: ReactNode;
  children: ReactNode;
};

export const WorkspaceDetailLayout = ({
  rail,
  navigationLabel,
  renderNavigation,
  secondarySidebar,
  children
}: WorkspaceDetailLayoutProps) => {
  const [navMode, setNavMode] = useState<'auto' | 'expanded' | 'collapsed'>('auto');
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const expanded = navMode === 'expanded' || (navMode === 'auto' && windowWidth >= 1320);
  const controls = {
    expanded,
    expand: () => setNavMode('expanded'),
    collapse: () => setNavMode('collapsed')
  };

  return (
    <div
      className={[
        styles.body,
        expanded ? styles.bodyDetailExpanded : styles.bodyDetailCollapsed
      ].join(' ')}
    >
      {rail}
      {expanded ? (
        <NavSidebar>{renderNavigation(controls)}</NavSidebar>
      ) : (
        <FoldedRail label={navigationLabel} onExpand={controls.expand}>
          {renderNavigation(controls)}
        </FoldedRail>
      )}
      {secondarySidebar && <div className={sidePanelStyles.panel}>{secondarySidebar}</div>}
      <main className={styles.main}>{children}</main>
    </div>
  );
};
