import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { DetailLayoutConfig } from '@arch-register/api-types/schemaContract';
import styles from '../EntityDetailScreen.module.css';
import { EntityOverviewLayout } from './EntityOverviewLayout';
import { EntityRelationsTab } from './EntityRelationsTab';
import { EntityChangeHistoryTab } from './EntityChangeHistoryTab';
import { EntityFuturePlansTab } from './EntityFuturePlansTab';
import { EntityConformanceTab } from './EntityConformanceTab';
import { EntityRelatedContentTab } from './EntityRelatedContentTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  layout: DetailLayoutConfig;
  relationCount: number;
  futurePlansCount: number;
  activeViolationCount: number;
  canViewAudit: boolean;
  overviewProps: Omit<ComponentProps<typeof EntityOverviewLayout>, 'layout'>;
  relationsProps: ComponentProps<typeof EntityRelationsTab>;
  relatedContentProps: ComponentProps<typeof EntityRelatedContentTab>;
  changeHistoryProps: ComponentProps<typeof EntityChangeHistoryTab>;
  futurePlansProps: ComponentProps<typeof EntityFuturePlansTab>;
  conformanceProps: ComponentProps<typeof EntityConformanceTab>;
};

// Folds the schema's configurable detail-layout tabs (e.g. "Details", "Technical") into the same
// top-level tab bar as the fixed Relations/Related content/Conformance/Planned changes/Change history tabs, rather than
// nesting them inside a single "Overview" tab.
export const EntityOverviewSection = ({
  tab,
  setTab,
  layout,
  relationCount,
  futurePlansCount,
  activeViolationCount,
  canViewAudit,
  overviewProps,
  relationsProps,
  relatedContentProps,
  changeHistoryProps,
  futurePlansProps,
  conformanceProps
}: Props) => {
  const activeLayoutTab = layout.tabs.find(layoutTab => layoutTab.id === tab) ?? layout.tabs[0];
  const nonLayoutTabIds = [
    'relations',
    'related-content',
    'future-plans',
    'conformance',
    'changes'
  ];

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
              Relations{relationCount > 0 ? ` (${relationCount})` : ''}
            </Tabs.Trigger>
            <Tabs.Trigger value="related-content">Related content</Tabs.Trigger>
            {conformanceProps.canViewConformance && (
              <Tabs.Trigger value="conformance">
                Conformance{activeViolationCount > 0 ? ` (${activeViolationCount})` : ''}
              </Tabs.Trigger>
            )}
            <Tabs.Trigger value="future-plans">Planned changes ({futurePlansCount})</Tabs.Trigger>
            {canViewAudit && <Tabs.Trigger value="changes">Change history</Tabs.Trigger>}
          </Tabs.List>
        </Tabs.Root>
      </div>
      {activeLayoutTab && !nonLayoutTabIds.includes(tab) && (
        <EntityOverviewLayout {...overviewProps} layout={{ version: 1, tabs: [activeLayoutTab] }} />
      )}
      {tab === 'relations' && <EntityRelationsTab {...relationsProps} />}
      {tab === 'related-content' && <EntityRelatedContentTab {...relatedContentProps} />}
      {tab === 'future-plans' && <EntityFuturePlansTab {...futurePlansProps} />}
      {tab === 'conformance' && <EntityConformanceTab {...conformanceProps} />}
      {tab === 'changes' && <EntityChangeHistoryTab {...changeHistoryProps} />}
    </>
  );
};
