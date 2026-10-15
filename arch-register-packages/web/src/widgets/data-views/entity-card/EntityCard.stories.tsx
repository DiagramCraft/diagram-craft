import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityCard } from './EntityCard';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const entityId = 'entity-payments';
const entity = {
  _uid: entityId,
  _publicId: 'payments-api',
  _name: 'Payments API',
  _slug: 'payments-api',
  _description: 'Handles payment processing for the checkout flow.',
  _tags: ['critical', 'customer-facing'],
  _schema: { id: 'service', name: 'Service', icon: 'server' },
  _owner: { id: 'platform', name: 'Platform' },
  _lifecycle: { id: 'active', name: 'Active' }
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.detail(WORKSPACE, entityId), entity);

const meta = {
  title: 'Widgets/Data views/Entity card',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiDefault: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityCard config={{ entityId }} />
    </StoryProviders>
  )
};

export const WikiExpanded: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityCard config={{ entityId, fields: 'owner,description,tags' }} />
    </StoryProviders>
  )
};

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[dashboardWidget('entity-card', 'EntityCard', { entityId }, 0, 0, 3, 2)]}
      />
    </StoryProviders>
  )
};

export const DashboardWide: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-card-wide',
            'EntityCard',
            { entityId, fields: 'owner,description,tags' },
            0,
            0,
            6,
            4
          )
        ]}
      />
    </StoryProviders>
  )
};
