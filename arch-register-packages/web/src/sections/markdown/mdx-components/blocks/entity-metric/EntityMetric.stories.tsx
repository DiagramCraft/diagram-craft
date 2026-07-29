import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityMetric } from './EntityMetric';
import { DashboardStory, StoryProviders, dashboardWidget } from '../StorybookHarness';

const meta = {
  title: 'MDX Blocks/EntityMetric',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiVariants: Story = {
  render: () => (
    <StoryProviders>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <EntityMetric metricType="entity-count" />
        <EntityMetric metricType="project-count" />
        <EntityMetric metricType="diagram-count" />
        <EntityMetric metricType="completeness-percent" />
      </div>
    </StoryProviders>
  )
};

export const DashboardVariants: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-count',
            'EntityMetric',
            { metricType: 'entity-count' },
            0,
            0,
            3,
            2
          ),
          dashboardWidget(
            'project-count',
            'EntityMetric',
            { metricType: 'project-count' },
            3,
            0,
            3,
            2
          ),
          dashboardWidget(
            'diagram-count',
            'EntityMetric',
            { metricType: 'diagram-count' },
            6,
            0,
            3,
            2
          ),
          dashboardWidget(
            'completeness',
            'EntityMetric',
            { metricType: 'completeness-percent' },
            9,
            0,
            3,
            2
          )
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget('default', 'EntityMetric', { metricType: 'entity-count' }, 0, 0, 3, 2)
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardWide: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget('wide', 'EntityMetric', { metricType: 'entity-count' }, 0, 0, 6, 4)
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardLarge: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget('large', 'EntityMetric', { metricType: 'entity-count' }, 0, 0, 12, 6)
        ]}
      />
    </StoryProviders>
  )
};
