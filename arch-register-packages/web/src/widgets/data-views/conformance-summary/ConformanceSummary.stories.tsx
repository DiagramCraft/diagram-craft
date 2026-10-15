import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConformanceSummary } from '@arch-register/api-types/conformanceContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { conformanceKeys } from '../../../queries/conformance';

const noViolations: ConformanceSummary = {
  active: 0,
  acknowledged: 0,
  warnings: 0,
  errors: 0,
  exempt: 0,
  resolvedRecently: 0,
  lastRunAt: '2026-08-21T02:05:00.000Z',
  byCheck: [],
  bySchema: []
};

const mixedResults: ConformanceSummary = {
  active: 9,
  acknowledged: 2,
  warnings: 5,
  errors: 4,
  exempt: 3,
  resolvedRecently: 6,
  lastRunAt: '2026-08-21T02:05:00.000Z',
  byCheck: [
    { id: 'check-api-owner', name: 'Services must have an owner', count: 4 },
    { id: 'check-lifecycle', name: 'Services must have a lifecycle', count: 3 },
    { id: 'check-data-classification', name: 'Data classification policy', count: 2 },
    { id: 'check-documentation', name: 'Critical services need documentation', count: 1 }
  ],
  bySchema: [{ id: 'service', name: 'Service', count: 9 }]
};

const meta = {
  title: 'Widgets/Data views/Conformance summary',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: A compact summary of the current conformance violations in the workspace, grouped by severity, by check and by schema. Use it as the entry point to conformance work: the numbers show how big the problem is and where it is concentrated. It needs permission to read conformance results.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDashboard = (
  summary: ConformanceSummary,
  permissions?: { canViewSchemas?: boolean }
) => {
  const client = createStoryQueryClient();
  client.setQueryData(conformanceKeys.summary(WORKSPACE), summary);

  return (
    <StoryProviders client={client} permissions={permissions}>
      <DashboardStory
        widgets={[
          dashboardWidget('conformance-summary', 'conformance-violation-summary', {}, 0, 0, 5, 4)
        ]}
      />
    </StoryProviders>
  );
};

export const NoViolations: Story = {
  render: () => renderDashboard(noViolations)
};

export const MixedResults: Story = {
  render: () => renderDashboard(mixedResults)
};

export const NoAccess: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The viewer lacks permission, so the widget explains that instead of showing numbers.'
      }
    }
  },
  render: () => renderDashboard(noViolations, { canViewSchemas: false })
};

export const WithFrame: Story = {
  ...NoViolations,
  args: { showFrame: true }
};
