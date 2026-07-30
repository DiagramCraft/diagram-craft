import type { Meta, StoryObj } from '@storybook/react-vite';
import { Metric } from './Metric';
import {
  createStoryQueryClient,
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget
} from '../StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';
import { projectKeys } from '../../../../../queries/projects';

const meta = {
  title: 'MDX Blocks/Metric',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryDefaults(entityKeys.all, { staleTime: Infinity });
storyQueryClient.setQueryDefaults(projectKeys.all, { staleTime: Infinity });
storyQueryClient.setQueryData(projectKeys.list(WORKSPACE), [
  { file_count: 3 },
  { file_count: 5 },
  { file_count: 2 }
]);
storyQueryClient.setQueryData(entityKeys.facets(WORKSPACE), {
  total: 10,
  lifecycle: [],
  owner: [],
  schema: [{ schemaId: 'service', count: 10 }],
  completeness: { below50: 2, below80: 3, above80: 5 }
});

export const WikiVariants: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Metric metricType="entity-count" />
        <Metric metricType="project-count" />
        <Metric metricType="diagram-count" />
        <Metric metricType="completeness-percent" />
      </div>
    </StoryProviders>
  )
};

export const DashboardVariants: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget('entity-count', 'Metric', { metricType: 'entity-count' }, 0, 0, 3, 2),
          dashboardWidget('project-count', 'Metric', { metricType: 'project-count' }, 3, 0, 3, 2),
          dashboardWidget('diagram-count', 'Metric', { metricType: 'diagram-count' }, 6, 0, 3, 2),
          dashboardWidget(
            'completeness',
            'Metric',
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
        widgets={[dashboardWidget('default', 'Metric', { metricType: 'entity-count' }, 0, 0, 3, 2)]}
      />
    </StoryProviders>
  )
};

export const DashboardWide: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[dashboardWidget('wide', 'Metric', { metricType: 'entity-count' }, 0, 0, 6, 4)]}
      />
    </StoryProviders>
  )
};

export const DashboardLarge: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[dashboardWidget('large', 'Metric', { metricType: 'entity-count' }, 0, 0, 12, 6)]}
      />
    </StoryProviders>
  )
};
