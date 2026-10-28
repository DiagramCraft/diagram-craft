import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { EntityTopologyTab } from './EntityTopologyTab';
import { EntityGraphView } from './EntityGraphView';
import { EntityBlastRadiusTab } from './EntityBlastRadiusTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  topologyProps: ComponentProps<typeof EntityTopologyTab>;
  graphProps: ComponentProps<typeof EntityGraphView>;
  blastRadiusProps: ComponentProps<typeof EntityBlastRadiusTab>;
};

export const EntityContextSection = ({
  tab,
  setTab,
  topologyProps,
  graphProps,
  blastRadiusProps
}: Props) => (
  <>
    <div className={styles.tabBar}>
      <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
        <Tabs.List overflow>
          <Tabs.Trigger value="topology">Topology</Tabs.Trigger>
          <Tabs.Trigger value="graph">Graph</Tabs.Trigger>
          <Tabs.Trigger value="blast-radius">Blast radius</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>
    {tab === 'topology' && <EntityTopologyTab {...topologyProps} />}
    {tab === 'graph' && (
      <div className={styles.graphPanel}>
        <EntityGraphView {...graphProps} />
      </div>
    )}
    {tab === 'blast-radius' && <EntityBlastRadiusTab {...blastRadiusProps} />}
  </>
);
