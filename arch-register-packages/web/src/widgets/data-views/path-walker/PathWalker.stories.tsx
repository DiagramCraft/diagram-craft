import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const STORY_SCHEMAS = [
  { id: 'capability', name: 'Capability', icon: 'target', entity_count: 3, fields: [] }
] as unknown as EntitySchema[];

const capability = (id: string, name: string) => ({
  _uid: id,
  _publicId: id.toUpperCase(),
  _name: name
});

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(
  entityKeys.list(WORKSPACE, { schemaId: 'capability', view: 'summary', limit: 1000 }),
  {
    items: [
      capability('c1', 'Order management'),
      capability('c2', 'Payments'),
      capability('c3', 'Customer onboarding')
    ],
    total: 3
  }
);

const meta = {
  title: 'Widgets/Data views/Relationship walker',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: Walks from every entity of one type through a chain of relations, with one column per hop, so that an end-to-end path such as capability to application to infrastructure can be read in a single view. The author sets up the starting chain, which can be locked, and viewers select an entity in a column to see what it connects to in the next one.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FromCapabilities: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={STORY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'capability-walker',
            'PathWalker',
            { rootSchemaName: 'Capability', hops: [] },
            0,
            0,
            8,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...FromCapabilities,
  args: { showFrame: true }
};
