import type { Meta, StoryObj } from '@storybook/react-vite';
import { configDialogStory, frameControls } from '../../shared/mdx/StorybookHarness';
import { assessmentWidgetStory } from '../../shared/data/assessmentWidgetStoryFixtures';

/** Assessment status stat widget; status is derived from each assessment's completed-entity rollup. */
const meta = {
  title: 'Widgets/Metrics/Assessment status',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: The number of assessments on an entity type that are in one chosen status: overdue, in progress, not started or complete. A subtext template can use `{count}`, `{total}` and `{notStarted}`. Use it as a KPI tile above an assessment table.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const STAT = { schemaName: 'Data Entity' };

export const Overdue: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentStatusStat',
      {
        ...STAT,
        status: 'overdue',
        label: 'Overdue',
        subtextTemplate: 'past the scheduled date'
      },
      { w: 3, h: 8 }
    )
};

export const InProgress: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentStatusStat',
      {
        ...STAT,
        status: 'in_progress',
        label: 'In progress',
        subtextTemplate: '{notStarted} not started'
      },
      { w: 3, h: 8 }
    )
};

export const Complete: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentStatusStat',
      {
        ...STAT,
        status: 'complete',
        label: 'Complete',
        subtextTemplate: 'of {total} assessments'
      },
      { w: 3, h: 8 }
    )
};

export const UnknownSchema: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentStatusStat',
      { schemaName: 'Nope', status: 'overdue' },
      { w: 3, h: 8 }
    )
};

export const WithFrame: Story = {
  ...Overdue,
  args: { frameStyle: 'header' }
};

export const ConfigDialog = configDialogStory('AssessmentStatusStat');
