import type { Meta, StoryObj } from '@storybook/react-vite';
import { dataStewardshipWidgetStory } from './dataStewardshipDashboardWidgetStoryFixtures';

const meta = {
  title: 'Dashboard Widgets/Case Count',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const COUNT_CONFIG = {
  label: 'Cases awaiting a decision',
  scope: 'workspace',
  caseKinds: ['entity.change-case', 'entity.deprecation'],
  tone: 'warning',
  subtextTemplate: '{due} due within a week',
  dueWithinDays: 7
};

export const Default: Story = {
  render: () =>
    dataStewardshipWidgetStory('data-stewardship-case-count', COUNT_CONFIG, { w: 3, h: 5 })
};

export const PastDue: Story = {
  render: () =>
    dataStewardshipWidgetStory(
      'data-stewardship-case-count',
      { ...COUNT_CONFIG, label: 'Past due', scope: 'late', tone: 'danger', caseKinds: [] },
      { w: 3, h: 5 }
    )
};

export const NotConfigured: Story = {
  render: () =>
    dataStewardshipWidgetStory(
      'data-stewardship-case-count',
      COUNT_CONFIG,
      { w: 3, h: 5 },
      {
        configured: false
      }
    )
};
