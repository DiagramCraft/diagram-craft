import type { Meta, StoryObj } from '@storybook/react-vite';
import { dataStewardshipWidgetStory } from './dataStewardshipDashboardWidgetStoryFixtures';

const meta = {
  title: 'Widgets/Visualizations/Next six weeks',
  tags: ['dashboard', 'workspace-surface'],
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const CONFIG = { label: 'Next six weeks', scope: 'workspace', caseKinds: [] };

export const Default: Story = {
  render: () =>
    dataStewardshipWidgetStory('data-stewardship-case-calendar', CONFIG, { w: 12, h: 14 })
};

export const Empty: Story = {
  render: () =>
    dataStewardshipWidgetStory(
      'data-stewardship-case-calendar',
      CONFIG,
      { w: 12, h: 14 },
      {
        cases: []
      }
    )
};
