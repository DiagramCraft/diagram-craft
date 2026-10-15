import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createStoryQueryClient,
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';
import { projectKeys } from '../../../queries/projectKeys';

const meta = {
  title: 'Widgets/Metrics/Metric',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and dashboards (workspace and project): A single live count, such as the number of entities, projects or diagrams, optionally filtered by schema, owner and lifecycle. Use it for a headline number. A link to the corresponding list can be shown below it.'
      }
    }
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

const metricStory = (id: string, metricType: string): Story => ({
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory widgets={[dashboardWidget(id, 'Metric', { metricType }, 0, 0, 3, 8)]} />
    </StoryProviders>
  )
});

export const EntityCount: Story = metricStory('entity-count', 'entity-count');

export const ProjectCount: Story = metricStory('project-count', 'project-count');

export const DiagramCount: Story = metricStory('diagram-count', 'diagram-count');

export const CompletenessPercent: Story = metricStory(
  'completeness-percent',
  'completeness-percent'
);

export const WithFrame: Story = {
  ...EntityCount,
  args: { showFrame: true }
};
