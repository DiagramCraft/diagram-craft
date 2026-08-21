import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConformanceSummary } from '@arch-register/api-types/conformanceContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
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
  title: 'Dashboard Widgets/ConformanceSummary',
  parameters: {
    layout: 'padded'
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
          dashboardWidget(
            'conformance-summary',
            'conformance-violation-summary',
            {},
            0,
            0,
            5,
            4
          )
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
  render: () => renderDashboard(noViolations, { canViewSchemas: false })
};
