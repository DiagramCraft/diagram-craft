import type { Meta, StoryObj } from '@storybook/react-vite';
import { Column } from './Column';
import { Columns } from './Columns';
import { StoryProviders } from '../StorybookHarness';

const meta = {
  title: 'MDX Blocks/Columns',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiTwoColumns: Story = {
  render: () => (
    <StoryProviders>
      <Columns count="2">
        <Column>
          <h3>Service ownership</h3>
          <p>The Platform team owns the API and its operational runbooks.</p>
        </Column>
        <Column>
          <h3>Support model</h3>
          <p>Product teams can escalate incidents through the shared on-call rotation.</p>
        </Column>
      </Columns>
    </StoryProviders>
  )
};

export const WikiThreeColumns: Story = {
  render: () => (
    <StoryProviders>
      <Columns count="3">
        <Column>
          <h3>Design</h3>
          <p>Define the boundary and document its responsibilities.</p>
        </Column>
        <Column>
          <h3>Build</h3>
          <p>Implement the contract and add automated checks.</p>
        </Column>
        <Column>
          <h3>Operate</h3>
          <p>Monitor availability, ownership, and lifecycle changes.</p>
        </Column>
      </Columns>
    </StoryProviders>
  )
};

export const WikiDefaultCount: Story = {
  render: () => (
    <StoryProviders>
      <Columns count="4">
        <Column>
          <p>Unsupported counts fall back to a two-column layout.</p>
        </Column>
        <Column>
          <p>The grid still supports rich content in each column.</p>
        </Column>
      </Columns>
    </StoryProviders>
  )
};
