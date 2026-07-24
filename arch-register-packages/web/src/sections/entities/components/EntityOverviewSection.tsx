import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { EntityOverviewTab } from './EntityOverviewTab';
import { EntityRelationsTab } from './EntityRelationsTab';
import { EntityChangeHistoryTab } from './EntityChangeHistoryTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  relationCount: number;
  canViewAudit: boolean;
  overviewProps: ComponentProps<typeof EntityOverviewTab>;
  relationsProps: ComponentProps<typeof EntityRelationsTab>;
  changeHistoryProps: ComponentProps<typeof EntityChangeHistoryTab>;
};

export const EntityOverviewSection = ({
  tab,
  setTab,
  relationCount,
  canViewAudit,
  overviewProps,
  relationsProps,
  changeHistoryProps
}: Props) => (
  <>
    <div className={styles.tabBar}>
      <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
        <Tabs.List overflow>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="relations">
            Relationships{relationCount > 0 ? ` (${relationCount})` : ''}
          </Tabs.Trigger>
          {canViewAudit && <Tabs.Trigger value="changes">Change history</Tabs.Trigger>}
        </Tabs.List>
      </Tabs.Root>
    </div>
    {tab === 'overview' && <EntityOverviewTab {...overviewProps} />}
    {tab === 'relations' && <EntityRelationsTab {...relationsProps} />}
    {tab === 'changes' && <EntityChangeHistoryTab {...changeHistoryProps} />}
  </>
);
