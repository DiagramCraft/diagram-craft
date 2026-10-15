import type { Meta, StoryObj } from '@storybook/react-vite';
import { dataStewardshipWidgetStory } from './dataStewardshipDashboardWidgetStoryFixtures';

const meta = {
  title: 'Dashboard Widgets/Reviews Overdue',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () =>
    dataStewardshipWidgetStory(
      'data-stewardship-reviews-overdue',
      { subtextTemplate: 'scheduled review date passed' },
      { w: 3, h: 5 }
    )
};
