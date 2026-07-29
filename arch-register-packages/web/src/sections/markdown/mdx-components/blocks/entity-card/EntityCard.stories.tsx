import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityCard } from './EntityCard';
import { StoryProviders, WORKSPACE, createStoryQueryClient } from '../StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';

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
  title: 'MDX Blocks/EntityCard',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiDefault: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityCard id={entityId} />
    </StoryProviders>
  )
};

export const WikiExpanded: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityCard id={entityId} fields="owner,description,tags" />
    </StoryProviders>
  )
};
