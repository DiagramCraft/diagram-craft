import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { EntityAssessmentsTab, useUnansweredAssessmentCount } from './EntityAssessmentsTab';
import { EntityPlannedChangesTab } from './EntityPlannedChangesTab';
import { EntityTimelineTab } from './EntityTimelineTab';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  assessmentsProps: ComponentProps<typeof EntityAssessmentsTab>;
  plannedChangesProps: ComponentProps<typeof EntityPlannedChangesTab>;
  plannedChangesCount: number;
  timelineProps: ComponentProps<typeof EntityTimelineTab>;
};

export const EntityPlanningReviewSection = ({
  tab,
  setTab,
  assessmentsProps,
  plannedChangesProps,
  plannedChangesCount,
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
            <Tabs.Trigger value="future-plans">
              Planned changes ({plannedChangesCount})
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      {tab === 'assessments' && <EntityAssessmentsTab {...assessmentsProps} />}
      {tab === 'future-plans' && <EntityPlannedChangesTab {...plannedChangesProps} />}
      {tab === 'timeline' && <EntityTimelineTab {...timelineProps} />}
    </>
  );
};
