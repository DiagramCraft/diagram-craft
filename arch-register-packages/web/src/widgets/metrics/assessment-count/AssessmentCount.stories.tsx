import type { Meta, StoryObj } from '@storybook/react-vite';
import { assessmentWidgetStory } from '../../shared/data/assessmentWidgetStoryFixtures';

const meta = {
  title: 'Widgets/Metrics/Assessment count',
  tags: ['dashboard', 'workspace-surface'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The number of assessments that match a mode (active, upcoming, overdue or all), an optional assessment type and the entity types they cover. With `dueWithinDays` it counts open assessments due within that window, overdue ones included. Use it as a KPI tile above an assessment list.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentCount',
      { mode: 'active', label: 'Active assessments', subtext: 'currently open' },
      { w: 3, h: 5 }
    )
};

export const Overdue: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentCount',
      { mode: 'overdue', label: 'Overdue assessments', subtext: 'past the due date' },
      { w: 3, h: 5 }
    )
};

export const DueWithinMonth: Story = {
  render: () =>
    assessmentWidgetStory(
      'AssessmentCount',
      {
        mode: 'active',
        dueWithinDays: 30,
        label: 'Due within 30 days',
        subtext: 'including overdue'
      },
      { w: 3, h: 5 }
    )
};
