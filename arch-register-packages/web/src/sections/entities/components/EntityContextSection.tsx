import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { EntityTopologyTab } from './EntityTopologyTab';
import { EntityGraphView } from './EntityGraphView';
import { EntityDependentsTab } from './EntityDependentsTab';
import { EntityRelatedContentTab } from './EntityRelatedContentTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  dependentsCount: number;
  topologyProps: ComponentProps<typeof EntityTopologyTab>;
  graphProps: ComponentProps<typeof EntityGraphView>;
  dependentsProps: ComponentProps<typeof EntityDependentsTab>;
  relatedContentProps: ComponentProps<typeof EntityRelatedContentTab>;
};

export const EntityContextSection = ({
  tab,
  setTab,
  dependentsCount,
  topologyProps,
  graphProps,
  dependentsProps,
  relatedContentProps
}: Props) => (
  <>
    <div className={styles.tabBar}>
      <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
        <Tabs.List overflow>
          <Tabs.Trigger value="topology">Topology</Tabs.Trigger>
          <Tabs.Trigger value="graph">Graph</Tabs.Trigger>
          <Tabs.Trigger value="dependents">
            Dependents{dependentsCount > 0 ? ` (${dependentsCount})` : ''}
          </Tabs.Trigger>
          <Tabs.Trigger value="related-content">Related content</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>
    {tab === 'topology' && <EntityTopologyTab {...topologyProps} />}
    {tab === 'graph' && (
      <div className={styles.graphPanel}>
        <EntityGraphView {...graphProps} />
      </div>
    )}
    {tab === 'dependents' && <EntityDependentsTab {...dependentsProps} />}
    {tab === 'related-content' && <EntityRelatedContentTab {...relatedContentProps} />}
  </>
);
