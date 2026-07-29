import type { Meta, StoryObj } from '@storybook/react-vite';
import { FoldableSection } from './FoldableSection';
import { StoryProviders } from '../StorybookHarness';

const meta = {
  title: 'MDX Blocks/FoldableSection',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiArchitectureNotes: Story = {
  render: () => (
    <StoryProviders>
      <FoldableSection label="Architecture notes">
        <p>This service owns payment authorization and communicates with the ledger.</p>
        <ul>
          <li>Availability target: 99.9%</li>
          <li>Owner: Platform team</li>
        </ul>
      </FoldableSection>
    </StoryProviders>
  )
};

export const WikiDefaultLabel: Story = {
  render: () => (
    <StoryProviders>
      <FoldableSection>
        <p>Content is collapsed behind the default Details label.</p>
      </FoldableSection>
    </StoryProviders>
  )
};
