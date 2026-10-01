import type { Meta, StoryObj } from '@storybook/react-vite';
import type {
  ConformanceCheck,
  ConformanceViolation
} from '@arch-register/api-types/conformanceContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { conformanceKeys } from '../../../queries/conformance';

const SCHEMA_ID = 'story-data-entity-schema';
const SCHEMAS = [
  { id: SCHEMA_ID, name: 'Data Entity', icon: 'database', entity_count: 12, fields: [] }
] as unknown as EntitySchema[];

const CHECKS = [
  ['check-owner', 'Dataset has no business owner', 'error'],
  ['check-steward', 'Dataset has no steward', 'error'],
  ['check-classification', 'Dataset classification not confirmed', 'warning'],
  ['check-review', 'Dataset review not current', 'warning']
].map(([id, name, severity]) => ({ id, name, severity })) as unknown as ConformanceCheck[];

const violation = (
  entity: string,
  checkId: string,
  message: string,
  severity: 'error' | 'warning'
) =>
  ({
    id: `${entity}-${checkId}`,
    workspace: WORKSPACE,
    check_id: checkId,
    entity_id: entity,
    entity_name: entity,
    schema_id: SCHEMA_ID,
    severity,
    message,
    status: 'active'
  }) as unknown as ConformanceViolation;

const OWNER = ['check-owner', 'No business owner assigned', 'error'] as const;
const STEWARD = ['check-steward', 'No steward assigned', 'error'] as const;
const CLASSIFICATION = ['check-classification', 'Classification not confirmed', 'warning'] as const;
const REVIEW = ['check-review', 'Review is not current', 'warning'] as const;

const entitiesWithGaps = (
  gaps: Record<string, ReadonlyArray<readonly [string, string, 'error' | 'warning']>>
) =>
  Object.entries(gaps).flatMap(([entity, list]) =>
    list.map(([checkId, message, severity]) => violation(entity, checkId, message, severity))
  );

const meta = {
  title: 'Dashboard Widgets/ConformanceViolations',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDashboard = (
  items: ConformanceViolation[],
  config: Record<string, unknown> = {},
  permissions?: { canViewSchemas?: boolean }
) => {
  const client = createStoryQueryClient();
  client.setQueryData(conformanceKeys.checks(WORKSPACE), CHECKS);
  for (const limit of [200, 1]) {
    client.setQueryData(
      conformanceKeys.violations(WORKSPACE, {
        schemaId: SCHEMA_ID,
        status: 'active',
        limit,
        offset: 0
      }),
      { items: items.slice(0, limit), total: items.length, limit, offset: 0 }
    );
  }
  return (
    <StoryProviders client={client} schemas={SCHEMAS} permissions={permissions}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'gaps',
            'ConformanceViolations',
            { schemaName: 'Data Entity', limit: 8, label: 'Gaps to close', ...config },
            0,
            0,
            12,
            10
          )
        ]}
      />
    </StoryProviders>
  );
};

const GAPS = entitiesWithGaps({
  'Customer Profile': [OWNER, STEWARD, REVIEW],
  'Payment Transactions': [STEWARD, CLASSIFICATION],
  'Product Catalog': [REVIEW],
  'Order History': [CLASSIFICATION],
  'Support Tickets': [OWNER]
});

export const WithGaps: Story = { render: () => renderDashboard(GAPS) };

export const MoreThanLimit: Story = {
  render: () => renderDashboard(GAPS, { limit: 3 })
};

export const FilteredByCheck: Story = {
  render: () => renderDashboard(GAPS, { checkNames: ['Dataset has no steward'] })
};

export const NoGaps: Story = { render: () => renderDashboard([]) };

export const UnknownSchema: Story = {
  render: () => renderDashboard(GAPS, { schemaName: 'Nonexistent' })
};

export const NoAccess: Story = {
  render: () => renderDashboard(GAPS, {}, { canViewSchemas: false })
};
