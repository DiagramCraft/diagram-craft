import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './Label';
import { StoryProviders } from '../../shared/mdx/StorybookHarness';

const meta = {
  title: 'Widgets/Content & layout/Label',
  tags: ['mdx', 'inline'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A small inline, coloured status label (chip) for use inside a sentence or a table cell, for example to flag something as Approved or Deprecated. The colour is optional and defaults to a neutral tone. Available in wiki pages only.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiStatusLabels: Story = {
  render: () => (
    <StoryProviders>
      <p>
        Service status: <Label text="Production" color="#22c55e" />{' '}
        <Label text="Customer-facing" color="#3b82f6" />{' '}
        <Label text="Needs review" color="#f59e0b" />
      </p>
    </StoryProviders>
  )
};

export const WikiWithoutColor: Story = {
  render: () => (
    <StoryProviders>
      <p>
        A neutral label: <Label text="Internal" color="" />
      </p>
    </StoryProviders>
  )
};

export const WikiEmptyText: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A label with no text renders an empty placeholder so it can still be selected and edited.'
      }
    }
  },
  render: () => (
    <StoryProviders>
      <p>
        Empty labels render nothing between these markers: <span>[</span>
        <Label text="" color="#ef4444" />
        <span>]</span>
      </p>
    </StoryProviders>
  )
};
