import type { Meta, StoryObj } from '@storybook/react-vite';
import { configDialogStory, frameControls } from '../../shared/mdx/StorybookHarness';
import {
  assessmentWidgetStory,
  seededAssessmentWidgetClient
} from '../../shared/data/assessmentWidgetStoryFixtures';

/** Assessment progress table; statuses are derived from each assessment's completed-entity rollup. */
const meta = {
  title: 'Widgets/Data views/Assessment progress',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: A table of assessments that target a chosen entity type, with progress, due date and derived status (not started, in progress, overdue or complete) for each. Optionally restrict it to one status. Use it to follow how a review campaign is going across the entities of one type.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const CONFIG = { schemaName: 'Data Entity' };

export const Default: Story = {
  render: () => assessmentWidgetStory('AssessmentProgressTable', CONFIG, { w: 12, h: 14 })
};

export const OverdueOnly: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentProgressTable',
      { ...CONFIG, status: 'overdue' },
      { w: 12, h: 8 }
    )
};

export const Empty: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentProgressTable',
      CONFIG,
      { w: 12, h: 8 },
      seededAssessmentWidgetClient([])
    )
};

export const WithFrame: Story = {
  ...Default,
  args: { showFrame: true }
};

export const ConfigDialog = configDialogStory('AssessmentProgressTable');
