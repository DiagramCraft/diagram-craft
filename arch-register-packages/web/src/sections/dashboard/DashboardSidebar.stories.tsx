import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../markdown/mdx-components/blocks/StorybookHarness';
import { relationKeys } from '../../queries/relations';
import { relationSchemaKeys } from '../../queries/relationSchemas';
import { DashboardSidebar } from './DashboardSidebar';

const RELATION_SCHEMA = {
  id: 'story-data-flow',
  name: 'Data Flow',
  fields: [
    {
      id: 'data_classification',
      name: 'Data Classification',
      type: 'select',
      options: [
        { value: 'public', label: 'Public' },
        { value: 'sensitive', label: 'Sensitive' },
        { value: 'highly-sensitive', label: 'Highly sensitive' }
      ]
    },
    {
      id: 'cross_boundary',
      name: 'Cross-Boundary Transfer',
      type: 'derived',
      resultType: 'text'
    }
  ]
} as unknown as RelationSchema;

const flow = (id: string, classification: string, boundary: string) =>
  ({
    _uid: id,
    _in: { id: `${id}-in`, name: 'A' },
    _out: { id: `${id}-out`, name: 'B' },
    data_classification: classification,
    cross_boundary: boundary
  }) as unknown as RelationRecord;

const FLOWS = [
  flow('f1', 'highly-sensitive', 'cross-boundary'),
  flow('f2', 'sensitive', 'same-region'),
  flow('f3', 'sensitive', 'cross-boundary'),
  flow('f4', 'public', 'same-region')
];

const meta = {
  title: 'Dashboard/DashboardSidebar',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A `facets` sidebar over a relation type: counts are tallied from the relations' own fields. */
export const RelationFacets: Story = {
  render: () => {
    const client = createStoryQueryClient();
    client.setQueryData(relationSchemaKeys.list(WORKSPACE), [RELATION_SCHEMA]);
    client.setQueryData(relationKeys.list(WORKSPACE, { schemaId: 'story-data-flow', limit: 200 }), {
      items: FLOWS,
      total: FLOWS.length
    });
    return (
      <StoryProviders client={client}>
        <div style={{ width: 260 }}>
          <DashboardSidebar
            workspaceSlug={WORKSPACE}
            title="Integrations"
            sidebar={{
              kind: 'facets',
              schemaName: 'Data Flow',
              schemaKind: 'relation',
              facets: [
                {
                  fieldId: 'Data Classification',
                  variableName: 'classifications',
                  itemLabel: 'Classification'
                },
                {
                  fieldId: 'Cross-Boundary Transfer',
                  variableName: 'boundaries',
                  itemLabel: 'Boundary'
                }
              ]
            }}
          />
        </div>
      </StoryProviders>
    );
  }
};
