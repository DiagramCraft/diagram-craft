import type { Meta, StoryObj } from '@storybook/react-vite';
import { WikiLink } from './WikiLink';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../../shared/mdx/StorybookHarness';
import { projectFileKeys } from '../../../queries/content';

const pageId = 'page-runbook';

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(projectFileKeys.detail(WORKSPACE, pageId), {
  id: pageId,
  type: 'markdown',
  name: 'Incident runbook',
  path: 'ops/incident-runbook.md',
  project_id: null,
  entity_id: null,
  comment_count: 0,
  unresolved_comment_count: 0
});

const missingPageQueryClient = createStoryQueryClient();
missingPageQueryClient.setQueryData(projectFileKeys.detail(WORKSPACE, 'page-missing'), null);

const meta = {
  title: 'Widgets/Content & layout/Wiki page link',
  tags: ['mdx', 'inline'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages only: An inline link to another wiki page, referenced by page id so it survives renames and moves. Shows an unavailable state when the page is deleted or unreadable.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Link: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <p>
        When the service is down, follow the <WikiLink id={pageId} />.
      </p>
    </StoryProviders>
  )
};

export const Unavailable: Story = {
  render: () => (
    <StoryProviders client={missingPageQueryClient}>
      <p>
        Removed page: <WikiLink id="page-missing" />
      </p>
    </StoryProviders>
  )
};
