import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const numeratorCondition = { fieldId: 'status', op: 'equals' as const, value: 'met' };

const baseFilter = {
  schemaId: 'compliance_requirement',
  owner: undefined,
  lifecycle: undefined
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.count(WORKSPACE, baseFilter), { total: 40 });
storyQueryClient.setQueryData(
  entityKeys.count(WORKSPACE, { ...baseFilter, conditions: [numeratorCondition] }),
  { total: 27 }
);

const meta = {
  title: 'Widgets/Metrics/Aggregate stat',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ComplianceCoverage: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'compliance-coverage',
            'AggregateStat',
            {
              schema: 'compliance_requirement',
              numeratorCondition,
              label: 'Compliance coverage'
            },
            0,
            0,
            3,
            2
          )
        ]}
      />
    </StoryProviders>
  )
};
