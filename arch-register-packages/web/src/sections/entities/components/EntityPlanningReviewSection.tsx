import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { EntityAssessmentsTab, useUnansweredAssessmentCount } from './EntityAssessmentsTab';
import { EntityFuturePlansTab } from './EntityFuturePlansTab';
import { EntityTimelineTab } from './EntityTimelineTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  assessmentsProps: ComponentProps<typeof EntityAssessmentsTab>;
  futurePlansProps: ComponentProps<typeof EntityFuturePlansTab>;
  futurePlansCount: number;
  timelineProps: ComponentProps<typeof EntityTimelineTab>;
};

export const EntityPlanningReviewSection = ({
  tab,
  setTab,
  assessmentsProps,
  futurePlansProps,
  futurePlansCount,
  timelineProps
}: Props) => {
  const unansweredAssessments = useUnansweredAssessmentCount(
    assessmentsProps.workspaceId,
    assessmentsProps.entity._uid,
    assessmentsProps.schema
  );

  return (
    <>
      <div className={styles.tabBar}>
        <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
          <Tabs.List overflow>
            <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
            <Tabs.Trigger value="assessments">
              Assessments{unansweredAssessments > 0 ? ` (${unansweredAssessments})` : ''}
            </Tabs.Trigger>
            <Tabs.Trigger value="future-plans">Planned changes ({futurePlansCount})</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      {tab === 'assessments' && <EntityAssessmentsTab {...assessmentsProps} />}
      {tab === 'future-plans' && <EntityFuturePlansTab {...futurePlansProps} />}
      {tab === 'timeline' && <EntityTimelineTab {...timelineProps} />}
    </>
  );
};
