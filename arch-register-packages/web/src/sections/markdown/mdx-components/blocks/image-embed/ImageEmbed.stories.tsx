import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { ImageEmbed } from './ImageEmbed';
import { createStoryQueryClient, StoryProviders, WORKSPACE } from '../StorybookHarness';
import { projectFileKeys } from '../../../../../queries/content';

const imageAttachmentId = 'attachment-architecture-overview';
const attachmentId = 'attachment-not-an-image';

const imageAttachment: ProjectFile = {
  id: imageAttachmentId,
  project_id: null,
  entity_id: null,
  project_public_id: null,
  path: 'attachments/architecture-overview.svg',
  name: 'Architecture Overview',
  original_filename: 'architecture-overview.svg',
  mime_type: 'image/svg+xml',
  role: null,
  size_bytes: 2048,
  created_at: '2026-07-20T10:00:00.000Z',
  updated_at: '2026-07-29T09:30:00.000Z',
  type: 'file',
  content_metadata: null
};

const imageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 360">
  <rect width="960" height="360" rx="20" fill="#172033"/>
  <text x="48" y="64" fill="#f8fafc" font-family="sans-serif" font-size="28" font-weight="600">Architecture overview</text>
  <rect x="48" y="128" width="220" height="128" rx="12" fill="#2563eb"/>
  <text x="158" y="202" text-anchor="middle" fill="white" font-family="sans-serif" font-size="22">Web App</text>
  <rect x="370" y="128" width="220" height="128" rx="12" fill="#7c3aed"/>
  <text x="480" y="202" text-anchor="middle" fill="white" font-family="sans-serif" font-size="22">API</text>
  <rect x="692" y="128" width="220" height="128" rx="12" fill="#059669"/>
  <text x="802" y="202" text-anchor="middle" fill="white" font-family="sans-serif" font-size="22">Database</text>
  <path d="M268 192h102M590 192h102" stroke="#cbd5e1" stroke-width="6"/>
</svg>`;

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
storyQueryClient.setQueryData(
  projectFileKeys.detail(WORKSPACE, imageAttachmentId),
  imageAttachment
);
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

export const WikiWithImage: Story = {
  beforeEach: () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('attachments%2Farchitecture-overview.svg')) {
        return new Response(new Blob([imageSvg], { type: 'image/svg+xml' }), { status: 200 });
      }
      return originalFetch(input, init);
    };

    return () => {
      globalThis.fetch = originalFetch;
    };
  },
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <ImageEmbed id={imageAttachmentId} alt="Architecture overview" size="75" align="center" />
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
