import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { EntityOverviewTab } from './EntityOverviewTab';
import { EntityRelationsTab } from './EntityRelationsTab';
import { EntityTypedRelationsTab } from './EntityTypedRelationsTab';
import { EntityChangeHistoryTab } from './EntityChangeHistoryTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  relationCount: number;
  typedRelationCount: number;
  canViewAudit: boolean;
  overviewProps: ComponentProps<typeof EntityOverviewTab>;
  relationsProps: ComponentProps<typeof EntityRelationsTab>;
  typedRelationsProps: ComponentProps<typeof EntityTypedRelationsTab>;
  changeHistoryProps: ComponentProps<typeof EntityChangeHistoryTab>;
};

export const EntityOverviewSection = ({
  tab,
  setTab,
  relationCount,
  typedRelationCount,
  canViewAudit,
  overviewProps,
  relationsProps,
  typedRelationsProps,
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
          <Tabs.Trigger value="typed-relations">
            Typed relations{typedRelationCount > 0 ? ` (${typedRelationCount})` : ''}
          </Tabs.Trigger>
          {canViewAudit && <Tabs.Trigger value="changes">Change history</Tabs.Trigger>}
        </Tabs.List>
      </Tabs.Root>
    </div>
    {tab === 'overview' && <EntityOverviewTab {...overviewProps} />}
    {tab === 'relations' && <EntityRelationsTab {...relationsProps} />}
    {tab === 'typed-relations' && <EntityTypedRelationsTab {...typedRelationsProps} />}
    {tab === 'changes' && <EntityChangeHistoryTab {...changeHistoryProps} />}
  </>
);
