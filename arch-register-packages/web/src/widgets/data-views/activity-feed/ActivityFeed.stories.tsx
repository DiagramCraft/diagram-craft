import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';
import { auditKeys } from '../../../queries/audit';

const auditEntries: AuditLogEntry[] = [
  {
    id: 'audit-entity-update',
    workspace: WORKSPACE,
    timestamp: '2026-07-29T09:30:00.000Z',
    user_id: 'user-platform',
    user_display_name: 'Alex Morgan',
    operation: 'update',
    entity_type: 'entity',
    entity_id: 'entity-payments',
    public_id: 'payments-api',
    entity_name: 'Payments API',
    entity_slug: 'payments-api',
    schema_id: 'service',
    changes: { new: { owner: 'Platform' } },
    metadata: {}
  },
  {
    id: 'audit-project-create',
    workspace: WORKSPACE,
    timestamp: '2026-07-28T15:10:00.000Z',
    user_id: 'user-commerce',
    user_display_name: 'Jamie Lee',
    operation: 'create',
    entity_type: 'project',
    entity_id: 'project-checkout',
    public_id: 'checkout-modernization',
    entity_name: 'Checkout Modernization',
    entity_slug: 'checkout-modernization',
    schema_id: null,
    changes: { new: { name: 'Checkout Modernization' } },
    metadata: {}
  },
  {
    id: 'audit-assessment-response',
    workspace: WORKSPACE,
    timestamp: '2026-07-27T11:45:00.000Z',
    user_id: 'user-architecture',
    user_display_name: 'Taylor Smith',
    operation: 'create',
    entity_type: 'assessment_response',
    entity_id: 'response-api-health',
    public_id: null,
    entity_name: 'API health assessment response',
    entity_slug: null,
    schema_id: null,
    changes: { new: { score: 4 } },
    metadata: {}
  }
];

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(auditKeys.log(WORKSPACE, { limit: 15 }), auditEntries);

const meta = {
  title: 'Widgets/Data views/Activity feed',
  tags: ['dashboard', 'workspace-surface'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A live feed of recent activity from the audit log: who changed what, and when. The `limit` option sets how many entries are listed. Use it on an overview dashboard to give a feel for how active the catalog is. It requires access to the audit log, and is available on workspace dashboards.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDashboard = (w: number, h: number, id: string) => (
  <StoryProviders client={storyQueryClient} permissions={{ canViewAudit: true }}>
    <DashboardStory widgets={[dashboardWidget(id, 'activity-feed', { limit: 15 }, 0, 0, w, h)]} />
  </StoryProviders>
);

export const DashboardDefault: Story = {
  render: () => renderDashboard(3, 2, 'activity-feed')
};

export const DashboardWide: Story = {
  render: () => renderDashboard(6, 4, 'activity-feed-wide')
};

export const DashboardLarge: Story = {
  render: () => renderDashboard(12, 6, 'activity-feed-large')
};
