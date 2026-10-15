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
  {
    id: 'service',
    name: 'Service',
    icon: 'server',
    entity_count: 8,
    fields: [
      {
        id: 'team',
        name: 'Team',
        type: 'select',
        options: [
          { value: 'payments', label: 'Payments' },
          { value: 'checkout', label: 'Checkout' },
          { value: 'platform', label: 'Platform' }
        ]
      },
      {
        id: 'documented',
        name: 'Documented',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ]
      }
    ]
  }
] as unknown as EntitySchema[];

const service = (id: string, team: string, documented: string) => ({
  _uid: id,
  _publicId: id.toUpperCase(),
  _name: `Service ${id}`,
  team,
  documented
});

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.list(WORKSPACE, { schemaId: 'service', limit: 500 }), {
  items: [
    service('s1', 'payments', 'yes'),
    service('s2', 'payments', 'yes'),
    service('s3', 'payments', 'no'),
    service('s4', 'checkout', 'yes'),
    service('s5', 'checkout', 'no'),
    service('s6', 'checkout', 'no'),
    service('s7', 'platform', 'no'),
    service('s8', 'platform', 'no')
  ],
  total: 8
});

const meta = {
  title: 'Widgets/Metrics/Ratio bars',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: One coverage bar per value of a field, filled by the share of entities in that group that have a chosen value in another field, and coloured by how complete it is. Use it to compare coverage across teams or domains, for example the share of services that are documented per owning team.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DocumentedByTeam: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={STORY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'documented-by-team',
            'RatioBarList',
            {
              schemaName: 'Service',
              groupByFieldId: 'team',
              numeratorFieldId: 'documented',
              numeratorValue: 'yes',
              label: 'Documented services by team'
            },
            0,
            0,
            4,
            8
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...DocumentedByTeam,
  args: { showFrame: true }
};
