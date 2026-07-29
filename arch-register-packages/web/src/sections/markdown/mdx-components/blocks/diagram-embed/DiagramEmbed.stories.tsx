import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { DiagramEmbed } from './DiagramEmbed';
import { createStoryQueryClient, StoryProviders, WORKSPACE } from '../StorybookHarness';
import { projectFileKeys } from '../../../../../queries/content';

const previewFileId = 'diagram-system-context';
const emptyFileId = 'diagram-without-preview';

const createFile = (id: string, name: string, preview_svg?: string): ProjectFile => ({
  id,
  project_id: null,
  entity_id: null,
  project_public_id: null,
  path: `architecture/${name.toLowerCase().replaceAll(' ', '-')}.json`,
  name,
  role: null,
  size_bytes: 2048,
  created_at: '2026-07-20T10:00:00.000Z',
  updated_at: '2026-07-29T09:30:00.000Z',
  type: 'diagram',
  preview_svg,
  content_metadata: null
});

const previewFile = createFile(
  previewFileId,
  'System Context',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 260"><rect width="720" height="260" rx="12" fill="#172033"/><rect x="32" y="88" width="170" height="84" rx="8" fill="#2563eb"/><text x="117" y="137" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18">Web App</text><rect x="275" y="88" width="170" height="84" rx="8" fill="#7c3aed"/><text x="360" y="137" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18">API</text><rect x="518" y="88" width="170" height="84" rx="8" fill="#059669"/><text x="603" y="137" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18">Database</text><path d="M202 130h73M445 130h73" stroke="#cbd5e1" stroke-width="4" marker-end="url(#arrow)"/><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6Z" fill="#cbd5e1"/></marker></defs></svg>'
);
const emptyFile = createFile(emptyFileId, 'Unpublished Diagram');

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryDefaults(projectFileKeys.all, { staleTime: Infinity });
storyQueryClient.setQueryData(projectFileKeys.detail(WORKSPACE, previewFileId), previewFile);
storyQueryClient.setQueryData(projectFileKeys.detail(WORKSPACE, emptyFileId), emptyFile);
storyQueryClient.setQueryData(projectFileKeys.content(WORKSPACE, previewFileId), null);
storyQueryClient.setQueryData(projectFileKeys.content(WORKSPACE, emptyFileId), null);

const meta = {
  title: 'MDX Blocks/DiagramEmbed',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiWithPreview: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DiagramEmbed id={previewFileId} caption="System context diagram" />
    </StoryProviders>
  )
};

export const WikiNoPreview: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DiagramEmbed id={emptyFileId} caption="Preview pending" />
    </StoryProviders>
  )
};

export const WikiMissingId: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DiagramEmbed id="" />
    </StoryProviders>
  )
};
