import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityCard } from './EntityCard';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls
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
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and dashboards (workspace and project): A summary card for one entity: its name, type, status and a chosen set of fields (comma-separated field ids in `fields`). Use it to put one important system or owner in the spotlight, or to give a quick reference inside text.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityCard config={{ entityId }} />
    </StoryProviders>
  )
};

export const Expanded: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityCard config={{ entityId, fields: 'owner,description,tags' }} />
    </StoryProviders>
  )
};

export const Wide: Story = {
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

export const WithFrame: Story = {
  ...Wide,
  args: { showFrame: true }
};
