import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls
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
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace and project dashboards only: A single headline number computed from an entity query: a count, a sum of a number or currency field, or the number of distinct values. With a denominator query it can show a percentage, which makes it suitable for coverage and compliance figures. An optional second query provides a subtext such as "12 of 40", and a severity colours the value.'
      }
    }
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
            8
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...ComplianceCoverage,
  args: { showFrame: true }
};
