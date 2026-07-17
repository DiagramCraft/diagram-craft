import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { EntityAssessmentsTab } from './EntityAssessmentsTab';
import { EntityTimelineTab } from './EntityTimelineTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  assessmentsProps: ComponentProps<typeof EntityAssessmentsTab>;
  timelineProps: ComponentProps<typeof EntityTimelineTab>;
};

export const EntityPlanningReviewSection = ({
  tab,
  setTab,
  assessmentsProps,
  timelineProps
}: Props) => (
  <>
    <div className={styles.tabBar}>
      <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
        <Tabs.List overflow>
          <Tabs.Trigger value="assessments">Assessments</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>
    {tab === 'assessments' && <EntityAssessmentsTab {...assessmentsProps} />}
    {tab === 'timeline' && <EntityTimelineTab {...timelineProps} />}
  </>
);
