import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls,
  configDialogStory
} from '../../shared/mdx/StorybookHarness';

const QUERY = 'schema:"Vendor"';

const schemas = [
  {
    id: 'vendor',
    name: 'Vendor',
    icon: 'building',
    entity_count: 8,
    fields: []
  }
] as unknown as EntitySchema[];

const vendors = [
  ['Acme Cloud', 5, 3.8],
  ['PayCo', 5, 2.9],
  ['Insight AB', 4, 3.5],
  ['NetWorks', 4, 1.6],
  ['LeadGen', 3, 2.2],
  ['Docuware', 3, 3.1],
  ['PrintCo', 2, 1.2],
  ['Unscored Ltd', 3, undefined]
].map(([name, criticality, risk], index) => ({
  _uid: `vendor-${index}`,
  _publicId: `VND-${index}`,
  _name: name,
  _schemaId: 'vendor',
  criticality,
  risk
}));

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(['entities', 'queryText', 'entities', WORKSPACE, QUERY], {
  ok: true,
  entities: vendors
});

const bands = [
  { label: 'Low', min: 0, tone: 'good' },
  { label: 'Moderate', min: 2, tone: 'neutral' },
  { label: 'Elevated', min: 2.7, tone: 'warn', hot: true },
  { label: 'High', min: 3.4, tone: 'bad', hot: true }
];

const meta = {
  title: 'Widgets/Data views/Field matrix',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace and project dashboards only: Places records in a grid: rows are values of one numeric field (for example criticality) and columns are bands of another (for example risk score). Each cell shows the records that land in it as clickable chips, and cells in `hot` bands at or above `hotRowMin` can be emphasised. Use it for classic matrices such as a criticality-by-risk heat map. Records are selected with an entity query.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CriticalityByRisk: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Applications placed by criticality (rows) and risk score band (columns), with the dangerous corner emphasised.'
      }
    }
  },
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={schemas}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'criticality-by-risk',
            'FieldMatrix',
            {
              query: QUERY,
              rowFieldId: 'criticality',
              rows: [5, 4, 3, 2],
              valueFieldId: 'risk',
              bands,
              hotRowMin: 4,
              cornerLabel: 'criticality ↓ / risk →',
              label: 'Criticality × risk'
            },
            0,
            0,
            8,
            22
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithoutEmphasis: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={schemas}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'matrix-plain',
            'FieldMatrix',
            {
              query: QUERY,
              rowFieldId: 'criticality',
              rows: [5, 4, 3, 2],
              valueFieldId: 'risk',
              bands: bands.map(({ hot: _hot, ...band }) => band)
            },
            0,
            0,
            6,
            20
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...CriticalityByRisk,
  args: { showFrame: true }
};

export const ConfigDialog = configDialogStory('FieldMatrix');
