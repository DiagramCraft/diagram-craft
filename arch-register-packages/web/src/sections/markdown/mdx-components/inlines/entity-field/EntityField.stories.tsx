import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityField } from './EntityField';
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

const meta = {
  title: 'MDX Inlines/EntityField',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiOwner: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <p>
        Owner: <EntityField id={entityId} field="owner" />
      </p>
    </StoryProviders>
  )
};

export const WikiDescription: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <p>
        Description: <EntityField id={entityId} field="description" />
      </p>
    </StoryProviders>
  )
};

export const WikiTags: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <p>
        Tags: <EntityField id={entityId} field="tags" />
      </p>
    </StoryProviders>
  )
};

export const WikiUnavailableField: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <p>
        Unknown field: <EntityField id={entityId} field="unknown-field" />
      </p>
    </StoryProviders>
  )
};
