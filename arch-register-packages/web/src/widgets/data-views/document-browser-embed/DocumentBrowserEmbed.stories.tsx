import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DocumentListItem } from '@arch-register/api-types/projectDocumentDiscoveryContract';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import { documentBrowserEmbedCodec } from './DocumentBrowserEmbedCodec';
import { DOCUMENT_BROWSER_BASE_COLUMN_IDS, type DocumentBrowserEmbedConfig } from './types';
import {
  createStoryQueryClient,
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';
import { documentKeys } from '../../../queries/documents';

const documentOptions = {
  q: '',
  scope: 'workspace' as const,
  projectId: undefined,
  entityId: undefined,
  documentTypeId: undefined,
  conditions: [],
  sort: 'updated_at',
  sortDir: 'desc' as const,
  limit: 100
};

const documents: DocumentListItem[] = [
  {
    file: {
      id: 'file-architecture-overview',
      project_id: null,
      entity_id: null,
      project_public_id: null,
      path: 'architecture/overview.md',
      name: 'Architecture Overview',
      role: null,
      size_bytes: 1840,
      created_at: '2026-07-20T10:00:00.000Z',
      updated_at: '2026-07-29T09:30:00.000Z',
      type: 'markdown',
      content_metadata: null
    },
    scope: 'workspace',
    document_type_id: 'doc-type-adr',
    document_type_name: 'Architecture Decision',
    document_type_color: '#8b5cf6',
    document_type_icon: 'file-description',
    metadata: {}
  },
  {
    file: {
      id: 'file-platform-guidelines',
      project_id: null,
      entity_id: null,
      project_public_id: null,
      path: 'guides/platform-guidelines.md',
      name: 'Platform Guidelines',
      role: null,
      size_bytes: 2640,
      created_at: '2026-07-18T13:15:00.000Z',
      updated_at: '2026-07-28T15:10:00.000Z',
      type: 'markdown',
      content_metadata: null
    },
    scope: 'workspace',
    document_type_id: null,
    document_type_name: null,
    document_type_color: null,
    document_type_icon: null,
    metadata: {}
  }
];

const configured: DocumentBrowserEmbedConfig = {
  q: '',
  conditions: [],
  sort: 'updated_at',
  sortDir: 'desc',
  visibleBaseColumnIds: [...DOCUMENT_BROWSER_BASE_COLUMN_IDS],
  visibleFieldIds: []
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(documentKeys.types(WORKSPACE), []);
storyQueryClient.setQueryData(documentKeys.list(WORKSPACE, documentOptions), documents);

const meta = {
  title: 'Widgets/Data views/Document browser',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A filterable list of documents in the workspace or project. Narrow it by free-text search, document type or field conditions, choose the sort order and pick which columns are shown. Use it to give readers a curated entry point to files, for example all policies or all contracts for one project. Available in wiki pages and on dashboards.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiConfigured: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DocumentBrowserEmbed config={configured} />
    </StoryProviders>
  )
};

export const WikiNoConfiguration: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DocumentBrowserEmbed config={documentBrowserEmbedCodec.createDefault()} />
    </StoryProviders>
  )
};

const dashboardConfig = {
  q: '',
  conditions: [],
  sort: 'updated_at',
  sortDir: 'desc',
  visibleBaseColumnIds: [...DOCUMENT_BROWSER_BASE_COLUMN_IDS],
  visibleFieldIds: []
};

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'document-browser-embed',
            'DocumentBrowserEmbed',
            dashboardConfig,
            0,
            0,
            6,
            4
          )
        ]}
      />
    </StoryProviders>
  )
};
