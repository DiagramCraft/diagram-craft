import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityMention } from './EntityMention';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

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
  title: 'Widgets/Data views/Entity mention',
  tags: ['mdx', 'inline'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'An inline mention of an entity that shows its live name and lifecycle status, and links to the entity page. Use it in text to refer to a system or owner so that the reference stays current when the entity is renamed or retired. Available in wiki pages only.'
      }
    }
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
