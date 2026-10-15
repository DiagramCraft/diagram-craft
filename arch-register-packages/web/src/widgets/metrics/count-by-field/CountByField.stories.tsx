import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const STORY_SCHEMAS = [
  {
    id: 'objective',
    name: 'Objective',
    icon: 'target',
    entity_count: 7,
    fields: [
      {
        id: 'status',
        name: 'Status',
        type: 'select',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
          { value: 'achieved', label: 'Achieved' },
          { value: 'abandoned', label: 'Abandoned' }
        ]
      }
    ]
  }
] as unknown as EntitySchema[];

const objective = (id: string, status: string | null) => ({
  _uid: id,
  _publicId: id.toUpperCase(),
  _name: `Objective ${id}`,
  status
});

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.list(WORKSPACE, { schemaId: 'objective', limit: 1000 }), {
  items: [
    objective('o1', 'active'),
    objective('o2', 'active'),
    objective('o3', 'active'),
    objective('o4', 'draft'),
    objective('o5', 'achieved'),
    objective('o6', 'abandoned'),
    objective('o7', null)
  ],
  total: 7
});

const meta = {
  title: 'Widgets/Metrics/Count by field',
  tags: ['dashboard', 'workspace-surface'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The number of entities of a type, shown as one stacked bar divided by the values of a field, with a legend. Use it for a quick distribution such as objectives by status or applications by lifecycle.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ObjectivesByStatus: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={STORY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'objectives-by-status',
            'CountByField',
            { schemaName: 'Objective', fieldId: 'status', label: 'Objectives by status' },
            0,
            0,
            6,
            8
          )
        ]}
      />
    </StoryProviders>
  )
};
