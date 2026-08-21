import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { DetailLayoutConfig } from '@arch-register/api-types/schemaContract';
import styles from '../EntityDetailScreen.module.css';
import { EntityOverviewLayout } from './EntityOverviewLayout';
import { EntityRelationsTab } from './EntityRelationsTab';
import { EntityChangeHistoryTab } from './EntityChangeHistoryTab';
import { EntityFuturePlansTab } from './EntityFuturePlansTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  layout: DetailLayoutConfig;
  relationCount: number;
  futurePlansCount: number;
  canViewAudit: boolean;
  overviewProps: Omit<ComponentProps<typeof EntityOverviewLayout>, 'layout'>;
  relationsProps: ComponentProps<typeof EntityRelationsTab>;
  changeHistoryProps: ComponentProps<typeof EntityChangeHistoryTab>;
  futurePlansProps: ComponentProps<typeof EntityFuturePlansTab>;
};

// Folds the schema's configurable detail-layout tabs (e.g. "Details", "Technical") into the same
// top-level tab bar as the fixed Relationships/Future plans/Change history tabs, rather than
// nesting them inside a single "Overview" tab.
export const EntityOverviewSection = ({
  tab,
  setTab,
  layout,
  relationCount,
  futurePlansCount,
  canViewAudit,
  overviewProps,
  relationsProps,
  changeHistoryProps,
  futurePlansProps
}: Props) => {
  const activeLayoutTab = layout.tabs.find(layoutTab => layoutTab.id === tab) ?? layout.tabs[0];

  return (
    <>
      <div className={styles.tabBar}>
        <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
          <Tabs.List overflow>
            {layout.tabs.map(layoutTab => (
              <Tabs.Trigger key={layoutTab.id} value={layoutTab.id}>
                {layoutTab.title}
              </Tabs.Trigger>
            ))}
            <Tabs.Trigger value="relations">
              Relationships{relationCount > 0 ? ` (${relationCount})` : ''}
            </Tabs.Trigger>
            <Tabs.Trigger value="future-plans">Future plans ({futurePlansCount})</Tabs.Trigger>
            {canViewAudit && <Tabs.Trigger value="changes">Change history</Tabs.Trigger>}
          </Tabs.List>
        </Tabs.Root>
      </div>
      {activeLayoutTab && tab !== 'relations' && tab !== 'future-plans' && tab !== 'changes' && (
        <EntityOverviewLayout {...overviewProps} layout={{ version: 1, tabs: [activeLayoutTab] }} />
      )}
      {tab === 'relations' && <EntityRelationsTab {...relationsProps} />}
      {tab === 'future-plans' && <EntityFuturePlansTab {...futurePlansProps} />}
      {tab === 'changes' && <EntityChangeHistoryTab {...changeHistoryProps} />}
    </>
  );
};
