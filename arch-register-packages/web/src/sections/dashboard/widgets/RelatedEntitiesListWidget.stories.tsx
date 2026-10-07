import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const reference = (id: string, name: string, schemaId: string) => ({
  id,
  name,
  type: 'reference',
  schemaId
});

const STORY_SCHEMAS = [
  { id: 'objective', name: 'Objective', icon: 'target', entity_count: 1, fields: [] },
  {
    id: 'outcome',
    name: 'Outcome',
    icon: 'flag',
    entity_count: 2,
    fields: [
      { id: 'description', name: 'Description', type: 'longtext' },
      reference('objectives', 'Objectives', 'objective')
    ]
  },
  {
    id: 'initiative',
    name: 'Initiative',
    icon: 'rocket',
    entity_count: 2,
    fields: [
      { id: 'description', name: 'Description', type: 'longtext' },
      {
        id: 'status',
        name: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'draft', label: 'Draft' }
        ]
      },
      reference('objectives', 'Objectives', 'objective')
    ]
  },
  {
    id: 'measure',
    name: 'Measure',
    icon: 'gauge',
    entity_count: 3,
    fields: [
      { id: 'unit', name: 'Unit', type: 'text' },
      { id: 'baseline', name: 'Baseline', type: 'number' },
      { id: 'current', name: 'Current', type: 'number' },
      { id: 'target_value', name: 'Target Value', type: 'number' },
      reference('outcomes', 'Outcomes', 'outcome')
    ]
  }
] as unknown as EntitySchema[];

const entity = (uid: string, name: string, fields: Record<string, unknown> = {}) => ({
  _uid: uid,
  _publicId: uid.toUpperCase(),
  _name: name,
  ...fields
});

const listKey = (schemaId: string) =>
  entityKeys.list(WORKSPACE, { schemaId, view: 'full', limit: 1000 });

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(
  entityKeys.detail(WORKSPACE, 'OBJ1'),
  entity('obj1', 'Grow recurring revenue')
);
storyQueryClient.setQueryData(listKey('outcome'), {
  items: [
    entity('out1', 'Customers renew early', {
      description: 'Renewal rate improves year on year',
      objectives: ['obj1']
    }),
    entity('out2', 'Lower onboarding effort', { objectives: ['obj1'] }),
    entity('out3', 'Unrelated outcome', { objectives: ['obj2'] })
  ],
  total: 3
});
storyQueryClient.setQueryData(listKey('initiative'), {
  items: [
    entity('ini1', 'Self-service onboarding', {
      status: 'active',
      description: 'Remove manual setup steps',
      objectives: ['obj1']
    }),
    entity('ini2', 'Pricing review', { status: 'draft', objectives: ['obj1'] })
  ],
  total: 2
});
storyQueryClient.setQueryData(listKey('measure'), {
  items: [
    entity('mea1', 'Net revenue retention', {
      unit: '%',
      baseline: 90,
      current: 104,
      target_value: 110,
      outcomes: ['out1']
    }),
    entity('mea2', 'Time to first value', {
      unit: ' days',
      baseline: 30,
      current: 24,
      target_value: 10,
      outcomes: ['out2']
    }),
    entity('mea3', 'No data yet', { outcomes: ['out2'] }),
    entity('mea4', 'Unrelated measure', {
      baseline: 0,
      current: 1,
      target_value: 2,
      outcomes: ['out3']
    })
  ],
  total: 4
});

const meta = {
  title: 'Dashboard Widgets/RelatedEntitiesList',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outcomes: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={STORY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'outcomes',
            'RelatedEntitiesList',
            {
              entityId: 'OBJ1',
              schemaName: 'Outcome',
              referenceField: 'objectives',
              descriptionField: 'description',
              label: 'Outcomes'
            },
            0,
            0,
            4,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

export const InitiativesWithStatus: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={STORY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'initiatives',
            'RelatedEntitiesList',
            {
              entityId: 'OBJ1',
              schemaName: 'Initiative',
              referenceField: 'objectives',
              statusField: 'status',
              descriptionField: 'description',
              label: 'Initiatives'
            },
            0,
            0,
            4,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

/** Measures reach the objective through their outcomes, with a baseline → current → target bar. */
export const MeasuresWithProgress: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={STORY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'measures',
            'RelatedEntitiesList',
            {
              entityId: 'OBJ1',
              schemaName: 'Measure',
              referenceField: 'outcomes',
              viaSchemaName: 'Outcome',
              viaReferenceField: 'objectives',
              progressBaselineField: 'baseline',
              progressCurrentField: 'current',
              progressTargetField: 'target_value',
              progressUnitField: 'unit',
              label: 'Measures'
            },
            0,
            0,
            6,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

export const NoItemSelected: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={STORY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'no-selection',
            'RelatedEntitiesList',
            {
              entityId: '$objectiveId',
              schemaName: 'Outcome',
              referenceField: 'objectives',
              label: 'Outcomes'
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
