import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tab } from './Tab';
import { Tabs } from './Tabs';
import { StoryProviders } from '../StorybookHarness';

const meta = {
  title: 'MDX Blocks/Tabs',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiArchitectureViews: Story = {
  render: () => (
    <StoryProviders>
      <Tabs>
        <Tab label="Overview">
          <h3>Overview</h3>
          <p>This service handles payment authorization for the checkout flow.</p>
        </Tab>
        <Tab label="Dependencies">
          <h3>Dependencies</h3>
          <p>It depends on the ledger and fraud detection services.</p>
        </Tab>
        <Tab label="Operations">
          <h3>Operations</h3>
          <p>Use the on-call runbook for incidents and planned maintenance.</p>
        </Tab>
      </Tabs>
    </StoryProviders>
  )
};

export const WikiDefaultTabLabels: Story = {
  render: () => (
    <StoryProviders>
      <Tabs>
        <Tab>
          <p>The first unlabeled tab uses the Tab 1 fallback.</p>
        </Tab>
        <Tab label="   ">
          <p>The second unlabeled tab uses the Tab 2 fallback.</p>
        </Tab>
      </Tabs>
    </StoryProviders>
  )
};

export const WikiEmpty: Story = {
  render: () => (
    <StoryProviders>
      <Tabs />
    </StoryProviders>
  )
};
