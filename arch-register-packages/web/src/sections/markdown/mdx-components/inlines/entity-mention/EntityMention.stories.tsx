import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityMention } from './EntityMention';
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
  title: 'MDX Inlines/EntityMention',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiMention: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <p>
        The <EntityMention id={entityId} /> is part of the checkout platform.
      </p>
    </StoryProviders>
  )
};

export const WikiUnavailable: Story = {
  render: () => (
    <StoryProviders client={missingEntityQueryClient}>
      <p>
        Related component: <EntityMention id="entity-missing" />
      </p>
    </StoryProviders>
  )
};
