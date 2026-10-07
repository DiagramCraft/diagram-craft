import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';

const QUERY = 'schema:"Vendor"';

const schemas = [
  { id: 'vendor', name: 'Vendor', icon: 'building', entity_count: 8, fields: [] }
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
  title: 'Dashboard Widgets/FieldMatrix',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CriticalityByRisk: Story = {
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

export const WithoutFrame: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={schemas}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'matrix-frameless',
            'FieldMatrix',
            {
              query: QUERY,
              rowFieldId: 'criticality',
              rows: [5, 4, 3, 2],
              valueFieldId: 'risk',
              bands,
              showFrame: false
            },
            0,
            0,
            8,
            20
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
