import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { ImageEmbed } from './ImageEmbed';
import { createStoryQueryClient, StoryProviders, WORKSPACE } from '../StorybookHarness';
import { projectFileKeys } from '../../../../../queries/content';

const attachmentId = 'attachment-not-an-image';

const attachment: ProjectFile = {
  id: attachmentId,
  project_id: null,
  entity_id: null,
  project_public_id: null,
  path: 'attachments/architecture-notes.pdf',
  name: 'Architecture Notes',
  original_filename: 'architecture-notes.pdf',
  mime_type: 'application/pdf',
  role: null,
  size_bytes: 4096,
  created_at: '2026-07-20T10:00:00.000Z',
  updated_at: '2026-07-29T09:30:00.000Z',
  type: 'file',
  content_metadata: null
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryDefaults(projectFileKeys.all, { staleTime: Infinity });
storyQueryClient.setQueryData(projectFileKeys.detail(WORKSPACE, attachmentId), attachment);

const meta = {
  title: 'MDX Blocks/ImageEmbed',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiUnsupportedAttachment: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <ImageEmbed id={attachmentId} alt="Architecture notes" size="75" align="right" />
    </StoryProviders>
  )
};

export const WikiMissingId: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <ImageEmbed id="" />
    </StoryProviders>
  )
};
