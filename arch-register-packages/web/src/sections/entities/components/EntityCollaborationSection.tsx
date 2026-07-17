import type { ComponentProps } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../EntityDetailScreen.module.css';
import { DiscussionThread } from '../../discussions/DiscussionThread';
import type { TabId } from '../types/entityDetailTypes';

type Props = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  discussionProps: ComponentProps<typeof DiscussionThread>;
};

export const EntityCollaborationSection = ({ tab, setTab, discussionProps }: Props) => (
  <>
    <div className={styles.tabBar}>
      <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
        <Tabs.List overflow>
          <Tabs.Trigger value="discussions">Discussion</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>
    {tab === 'discussions' && (
      <div className={styles.tabPane}>
        <DiscussionThread {...discussionProps} />
      </div>
    )}
  </>
);
