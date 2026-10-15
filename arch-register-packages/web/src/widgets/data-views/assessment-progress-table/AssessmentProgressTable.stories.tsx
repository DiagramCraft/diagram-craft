import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  assessmentWidgetStory,
  seededAssessmentWidgetClient
} from '../../shared/data/assessmentWidgetStoryFixtures';

/** Assessment progress table; statuses are derived from each assessment's completed-entity rollup. */
const meta = {
  title: 'Widgets/Data views/Assessment progress',
  tags: ['dashboard', 'workspace-surface'],
  parameters: { layout: 'padded' }
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
