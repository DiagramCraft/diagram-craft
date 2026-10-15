import type { Meta, StoryObj } from '@storybook/react-vite';
import { dataStewardshipWidgetStory } from './dataStewardshipDashboardWidgetStoryFixtures';

const meta = {
  title: 'Widgets/Data views/Case queue',
  tags: ['dashboard', 'workspace-surface'],
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const CONFIG = { label: 'All open items', scope: 'workspace', caseKinds: [] };

export const Default: Story = {
  render: () => dataStewardshipWidgetStory('data-stewardship-case-queue', CONFIG, { w: 12, h: 22 })
};

export const Empty: Story = {
  render: () =>
    dataStewardshipWidgetStory(
      'data-stewardship-case-queue',
      CONFIG,
      { w: 12, h: 12 },
      {
        cases: []
      }
    )
};
