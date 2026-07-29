import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityLink } from './EntityLink';
import { StoryProviders, WORKSPACE, createStoryQueryClient } from '../../blocks/StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';

const entityId = 'entity-payments';
const entity = {
  _uid: entityId,
  _publicId: 'payments-api',
  _name: 'Payments API',
  _description: 'Handles payment processing for the checkout flow.',
  _tags: ['critical', 'customer-facing'],
  _schema: { id: 'service', name: 'Service', icon: 'server' },
  _owner: { id: 'platform', name: 'Platform' },
  _lifecycle: { id: 'active', name: 'Active' }
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.detail(WORKSPACE, entityId), entity);

const missingEntityQueryClient = createStoryQueryClient();
missingEntityQueryClient.setQueryData(entityKeys.detail(WORKSPACE, 'entity-missing'), null);

const meta = {
  title: 'MDX Inlines/EntityLink',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiLink: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <p>
        The checkout flow depends on <EntityLink id={entityId} /> for payment authorization.
      </p>
    </StoryProviders>
  )
};

export const WikiUnavailable: Story = {
  render: () => (
    <StoryProviders client={missingEntityQueryClient}>
      <p>
        Unknown dependency: <EntityLink id="entity-missing" />
      </p>
    </StoryProviders>
  )
};
