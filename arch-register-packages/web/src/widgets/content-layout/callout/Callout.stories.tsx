import type { Meta, StoryObj } from '@storybook/react-vite';
import { Callout } from './Callout';
import { StoryProviders } from '../../shared/mdx/StorybookHarness';

const meta = {
  title: 'Widgets/Content & layout/Callout',
  tags: ['mdx', 'block'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A highlighted block for a note, warning, tip or success message inside a wiki page. Pick a variant (`info`, `warning`, `danger`, `success`, `note`) to set the colour and icon; the body is ordinary wiki content, so it can hold text, lists and other widgets. Use it to make one important point stand out from the surrounding prose. Available in wiki pages only.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiInfo: Story = {
  render: () => (
    <StoryProviders>
      <Callout variant="info">
        <p>Services should expose health checks and document their ownership.</p>
      </Callout>
    </StoryProviders>
  )
};

export const WikiWarning: Story = {
  render: () => (
    <StoryProviders>
      <Callout variant="warning">
        <p>This integration is scheduled for retirement.</p>
        <p>Plan the replacement before the next platform release.</p>
      </Callout>
    </StoryProviders>
  )
};

export const WikiDanger: Story = {
  render: () => (
    <StoryProviders>
      <Callout variant="danger">
        <p>Do not publish credentials or other secrets in workspace documentation.</p>
      </Callout>
    </StoryProviders>
  )
};

export const WikiSuccess: Story = {
  render: () => (
    <StoryProviders>
      <Callout variant="success">
        <p>The migration completed successfully and all checks are green.</p>
      </Callout>
    </StoryProviders>
  )
};

export const WikiNote: Story = {
  render: () => (
    <StoryProviders>
      <Callout variant="note">
        <p>This note supports rich content such as lists and inline links.</p>
      </Callout>
    </StoryProviders>
  )
};

export const WikiInvalidVariant: Story = {
  render: () => (
    <StoryProviders>
      <Callout variant="unknown">
        <p>Unknown variants fall back to the standard information style.</p>
      </Callout>
    </StoryProviders>
  )
};
